const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = ''
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateRandomOAuthValue(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

export async function generatePkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

export function extractOAuthResponse(
  url: string,
  expectedRedirectUri: string,
): {
  code: string
  state: string
  error: string
  errorDescription: string
} {
  try {
    const redirected = new URL(url)
    const expected = new URL(expectedRedirectUri)
    if (redirected.origin !== expected.origin || redirected.pathname !== expected.pathname) {
      return { code: '', state: '', error: 'invalid_redirect', errorDescription: 'Unexpected OAuth redirect URL.' }
    }

    return {
      code: redirected.searchParams.get('code') ?? '',
      state: redirected.searchParams.get('state') ?? '',
      error: redirected.searchParams.get('error') ?? '',
      errorDescription: redirected.searchParams.get('error_description') ?? '',
    }
  } catch {
    return { code: '', state: '', error: 'invalid_redirect', errorDescription: 'Invalid OAuth redirect URL.' }
  }
}
