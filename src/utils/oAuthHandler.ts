import axios from 'redaxios'

import apiConfig from '../../config/api.config'

function getOAuthClientSecret(): string {
  const clientSecret = process.env.OAUTH_CLIENT_SECRET
  if (!clientSecret) {
    throw new Error('OAUTH_CLIENT_SECRET is not configured.')
  }
  return clientSecret
}

// After a successful authorisation, the code returned from the Microsoft OAuth 2.0 authorization URL
// will be used to request an access token. This function requests the access token with the authorisation code
// and returns the access token and refresh token on success.
export async function requestTokenWithAuthCode(
  code: string,
  codeVerifier: string,
): Promise<
  | { expiryTime: string; accessToken: string; refreshToken: string }
  | { error: string; errorDescription: string; errorUri: string }
> {
  const { clientId, redirectUri, authApi } = apiConfig
  const clientSecret = getOAuthClientSecret()

  // Construct URL parameters for OAuth2
  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('redirect_uri', redirectUri)
  params.append('client_secret', clientSecret)
  params.append('code', code)
  params.append('code_verifier', codeVerifier)
  params.append('grant_type', 'authorization_code')

  // Request access token
  return axios
    .post(authApi, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    .then(resp => {
      const { expires_in, access_token, refresh_token } = resp.data
      return { expiryTime: expires_in, accessToken: access_token, refreshToken: refresh_token }
    })
    .catch(err => {
      const data = err?.response?.data ?? {}
      return {
        error: typeof data.error === 'string' ? data.error : 'token_request_failed',
        errorDescription:
          typeof data.error_description === 'string'
            ? data.error_description
            : err instanceof Error
              ? err.message
              : 'Microsoft token request failed.',
        errorUri: typeof data.error_uri === 'string' ? data.error_uri : '',
      }
    })
}

// Verify the identity of the user with the access token and compare it with the userPrincipalName
// in the Microsoft Graph API. If the userPrincipalName matches, proceed with token storing.
export async function getAuthPersonInfo(accessToken: string) {
  const profileApi = apiConfig.driveApi.replace('/drive', '')
  return axios.get(profileApi, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}
