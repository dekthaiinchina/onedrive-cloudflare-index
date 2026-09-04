import { NextRequest, NextResponse } from 'next/server'

import siteConfig from '../../../config/site.config'
import { getAuthPersonInfo, requestTokenWithAuthCode } from '../../utils/oAuthHandler'
import {
  extractOAuthResponseFromRedirected,
  generateAuthorisationUrl,
  generatePkceChallenge,
  generateRandomOAuthValue,
} from '../../utils/oAuthClient'
import { storeOdAuthTokens } from '../../utils/odAuthTokenStore'
import { nodeApiHandler } from '../../utils/nodeApiHandler'

const flowCookie = 'od-oauth-flow'
const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' }

const serializeFlowCookie = (state: string, verifier: string, secure: boolean) =>
  [
    `${flowCookie}=${encodeURIComponent(`${state}.${verifier}`)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=600',
    ...(secure ? ['Secure'] : []),
  ].join('; ')

const clearFlowCookie = (secure: boolean) =>
  [`${flowCookie}=`, 'HttpOnly', 'Path=/', 'SameSite=Strict', 'Max-Age=0', ...(secure ? ['Secure'] : [])].join('; ')

const errorResponse = (status: number, error: string, description: string, secure: boolean) =>
  NextResponse.json(
    { error, description },
    {
      status,
      headers: { ...noStoreHeaders, 'Set-Cookie': clearFlowCookie(secure) },
    },
  )

async function webHandler(req: NextRequest): Promise<Response> {
  const secure = process.env.NODE_ENV === 'production' || req.nextUrl.protocol === 'https:'

  if (req.method === 'GET') {
    const state = generateRandomOAuthValue()
    const verifier = generateRandomOAuthValue(48)
    const codeChallenge = await generatePkceChallenge(verifier)
    const authorisationUrl = generateAuthorisationUrl({ state, codeChallenge })

    return NextResponse.json(
      { authorisationUrl },
      {
        headers: {
          ...noStoreHeaders,
          'Set-Cookie': serializeFlowCookie(state, verifier, secure),
        },
      },
    )
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...noStoreHeaders, Allow: 'GET, POST' },
    })
  }

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'invalid_request', 'Expected a JSON request body.', secure)
  }

  let redirectedUrl = ''
  try {
    const body = (await req.json()) as { redirectedUrl?: unknown }
    redirectedUrl = typeof body.redirectedUrl === 'string' ? body.redirectedUrl : ''
  } catch {
    return errorResponse(400, 'invalid_request', 'Invalid JSON request body.', secure)
  }

  if (!redirectedUrl || redirectedUrl.length > 8192) {
    return errorResponse(400, 'invalid_request', 'Invalid OAuth redirect URL.', secure)
  }

  const flow = req.cookies.get(flowCookie)?.value ?? ''
  const separator = flow.indexOf('.')
  const expectedState = separator > 0 ? flow.slice(0, separator) : ''
  const verifier = separator > 0 ? flow.slice(separator + 1) : ''
  if (!expectedState || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) {
    return errorResponse(400, 'invalid_state', 'The OAuth setup session expired. Restart step 2.', secure)
  }

  const oauthResponse = extractOAuthResponseFromRedirected(redirectedUrl)
  if (oauthResponse.error) {
    return errorResponse(
      400,
      oauthResponse.error,
      oauthResponse.errorDescription || 'Microsoft did not return an authorization code.',
      secure,
    )
  }
  if (!oauthResponse.code || oauthResponse.state !== expectedState) {
    return errorResponse(400, 'invalid_state', 'The returned OAuth state did not match this setup session.', secure)
  }

  try {
    const response = await requestTokenWithAuthCode(oauthResponse.code, verifier)
    if ('error' in response) {
      return errorResponse(400, response.error, response.errorDescription, secure)
    }

    const { expiryTime, accessToken, refreshToken } = response
    const { data, status } = await getAuthPersonInfo(accessToken)
    if (status !== 200) {
      return errorResponse(502, 'profile_request_failed', 'Microsoft Graph profile verification failed.', secure)
    }

    const configuredOwner = String(siteConfig.userPrincipalName).trim().toLowerCase()
    const authenticatedOwner = String(data.userPrincipalName ?? '')
      .trim()
      .toLowerCase()
    if (!configuredOwner || authenticatedOwner !== configuredOwner) {
      return errorResponse(
        403,
        'owner_mismatch',
        `Authenticated user ${data.userPrincipalName ?? '(unknown)'} does not match the configured owner.`,
        secure,
      )
    }

    const accessTokenExpiry = Number.parseInt(expiryTime, 10)
    if (!Number.isFinite(accessTokenExpiry) || accessTokenExpiry <= 0 || !accessToken || !refreshToken) {
      return errorResponse(502, 'invalid_token_response', 'Microsoft returned an incomplete token response.', secure)
    }

    await storeOdAuthTokens({ accessToken, accessTokenExpiry, refreshToken })
    return NextResponse.json(
      { stored: true },
      { headers: { ...noStoreHeaders, 'Set-Cookie': clearFlowCookie(secure) } },
    )
  } catch (error) {
    return errorResponse(
      500,
      'oauth_setup_failed',
      error instanceof Error ? error.message : 'Unexpected error.',
      secure,
    )
  }
}

export default nodeApiHandler(webHandler)
