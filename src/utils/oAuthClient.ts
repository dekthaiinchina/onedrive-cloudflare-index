import apiConfig from '../../config/api.config'
import { extractOAuthResponse, generatePkceChallenge, generateRandomOAuthValue } from './oauthSecurity'

export { generatePkceChallenge, generateRandomOAuthValue }

export function generateAuthorisationUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
  const { clientId, redirectUri, authApi, scope } = apiConfig
  const authUrl = authApi.replace('/token', '/authorize')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    response_mode: 'query',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${authUrl}?${params.toString()}`
}

export function extractOAuthResponseFromRedirected(url: string): {
  code: string
  state: string
  error: string
  errorDescription: string
} {
  return extractOAuthResponse(url, apiConfig.redirectUri)
}

export function extractAuthCodeFromRedirected(url: string): string {
  return extractOAuthResponseFromRedirected(url).code
}
