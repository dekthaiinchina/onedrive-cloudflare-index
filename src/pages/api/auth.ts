import { posix as pathPosix } from 'path-browserify'
import { NextRequest, NextResponse } from 'next/server'

import { getAccessToken, getProtectedRoute, verifyProtectedRoutePassword } from '.'
import { nodeApiHandler } from '../../utils/nodeApiHandler'
import {
  clearProtectedLoginFailures,
  clearProtectedSessionCookie,
  createProtectedSession,
  deleteProtectedSession,
  getProtectedSession,
  getProtectedSessionToken,
  isProtectedLoginRateLimited,
  recordProtectedLoginFailure,
  serializeProtectedSessionCookie,
} from '../../utils/protectedSession'

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' }
const jsonError = (status: number, error: string, extraHeaders: Record<string, string> = {}) =>
  NextResponse.json({ error }, { status, headers: { ...noStoreHeaders, ...extraHeaders } })

const isSameOriginRequest = (req: NextRequest) => {
  const origin = req.headers.get('origin')
  const fetchSite = req.headers.get('sec-fetch-site')
  return (!origin || origin === req.nextUrl.origin) && fetchSite !== 'cross-site'
}

async function webHandler(req: NextRequest): Promise<Response> {
  const secure = process.env.NODE_ENV === 'production' || req.nextUrl.protocol === 'https:'
  const currentToken = getProtectedSessionToken(req)

  if (req.method === 'GET') {
    return NextResponse.json(
      { authenticated: Boolean(await getProtectedSession(currentToken)) },
      { headers: noStoreHeaders },
    )
  }

  if (req.method === 'DELETE') {
    if (!isSameOriginRequest(req)) return jsonError(403, 'Cross-site requests are not allowed.')
    await deleteProtectedSession(currentToken)
    return NextResponse.json(
      { authenticated: false },
      { headers: { ...noStoreHeaders, 'Set-Cookie': clearProtectedSessionCookie(secure) } },
    )
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...noStoreHeaders, Allow: 'GET, POST, DELETE' },
    })
  }

  if (!isSameOriginRequest(req)) return jsonError(403, 'Cross-site requests are not allowed.')
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return jsonError(415, 'Expected a JSON request body.')
  }

  let path = ''
  let password = ''
  try {
    const body = (await req.json()) as { path?: unknown; password?: unknown }
    path = typeof body.path === 'string' ? body.path : ''
    password = typeof body.password === 'string' ? body.password : ''
  } catch {
    return jsonError(400, 'Invalid JSON request body.')
  }
  if (!path || path.length > 4096 || !password || password.length > 1024) {
    return jsonError(400, 'Path and password are required.')
  }

  const cleanPath = pathPosix.resolve('/', pathPosix.normalize(path))
  const protectedRoute = getProtectedRoute(cleanPath)
  if (!protectedRoute) return jsonError(401, 'Invalid credentials.')
  const clientIp = req.headers.get('cf-connecting-ip') ?? ''
  if (await isProtectedLoginRateLimited(clientIp, protectedRoute)) {
    return jsonError(429, 'Too many authentication attempts. Try again later.', { 'Retry-After': '900' })
  }

  const accessToken = await getAccessToken()
  if (!accessToken) return jsonError(403, 'OneDrive is not configured.')

  const result = await verifyProtectedRoutePassword(cleanPath, accessToken, password)
  if (result.code !== 200) {
    await recordProtectedLoginFailure(clientIp, protectedRoute)
    return jsonError(result.code === 500 ? 500 : 401, result.code === 500 ? result.message : 'Invalid credentials.')
  }

  await clearProtectedLoginFailures(clientIp, result.protectedRoute)
  const sessionToken = await createProtectedSession(result.protectedRoute, currentToken)
  return NextResponse.json(
    { authenticated: true },
    { headers: { ...noStoreHeaders, 'Set-Cookie': serializeProtectedSessionCookie(sessionToken, secure) } },
  )
}

export default nodeApiHandler(webHandler)

export const config = {
  api: {
    bodyParser: { sizeLimit: '8kb' },
  },
}
