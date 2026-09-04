import type { KVNamespace } from '@cloudflare/workers-types'
import type { NextRequest } from 'next/server'
import pathBrowserify from 'path-browserify'
import sha256 from 'crypto-js/sha256.js'

import siteConfig from '../../config/site.config.js'
import { generateRandomOAuthValue } from './oauthSecurity.ts'
import { getOneDriveIndexStore } from './odAuthTokenStore.ts'

const { posix: pathPosix } = pathBrowserify

export const protectedSessionCookie = 'od-protected-session'
const sessionKeyPrefix = 'protected-session:'
const loginFailureKeyPrefix = 'protected-login-failure:'
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/

type ProtectedSessionRecord = {
  version: 1
  authorizedRoutes: string[]
  expiresAt: number
}

type LoginFailureRecord = {
  count: number
}

export type ProtectedSessionStore = Pick<KVNamespace, 'get' | 'put' | 'delete'>

const normalizeRoute = (route: string) => pathPosix.resolve('/', route).toLowerCase()
const getSessionTtl = () => Math.floor(Math.max(300, Number(siteConfig.protectedSessionTtl) || 12 * 60 * 60))
const getLoginWindow = () => Math.floor(Math.max(60, Number(siteConfig.protectedLoginWindow) || 15 * 60))
const getLoginAttemptLimit = () => Math.floor(Math.max(1, Number(siteConfig.protectedLoginAttempts) || 10))
const getStore = (store?: ProtectedSessionStore) => store ?? getOneDriveIndexStore()
const sessionKey = (token: string) => `${sessionKeyPrefix}${sha256(token).toString()}`
const failureKey = (clientIp: string, route: string) =>
  `${loginFailureKeyPrefix}${sha256(`${clientIp}\0${normalizeRoute(route)}`).toString()}`

const parseSession = (value: string | null): ProtectedSessionRecord | null => {
  if (!value) return null
  try {
    const record = JSON.parse(value) as Partial<ProtectedSessionRecord>
    if (
      record.version !== 1 ||
      !Array.isArray(record.authorizedRoutes) ||
      !record.authorizedRoutes.every(route => typeof route === 'string') ||
      typeof record.expiresAt !== 'number' ||
      record.expiresAt <= Date.now()
    ) {
      return null
    }
    return record as ProtectedSessionRecord
  } catch {
    return null
  }
}

export function getProtectedSessionToken(req: NextRequest): string {
  const token = req.cookies.get(protectedSessionCookie)?.value ?? ''
  return sessionTokenPattern.test(token) ? token : ''
}

export function serializeProtectedSessionCookie(token: string, secure: boolean): string {
  return [
    `${protectedSessionCookie}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${getSessionTtl()}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export function clearProtectedSessionCookie(secure: boolean): string {
  return [
    `${protectedSessionCookie}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=0',
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export async function getProtectedSession(
  token: string,
  store?: ProtectedSessionStore,
): Promise<ProtectedSessionRecord | null> {
  if (!sessionTokenPattern.test(token)) return null
  return parseSession(await getStore(store).get(sessionKey(token)))
}

export async function isProtectedSessionAuthorized(
  token: string,
  protectedRoute: string,
  store?: ProtectedSessionStore,
): Promise<boolean> {
  const session = await getProtectedSession(token, store)
  return Boolean(session?.authorizedRoutes.includes(normalizeRoute(protectedRoute)))
}

export async function createProtectedSession(
  protectedRoute: string,
  previousToken = '',
  store?: ProtectedSessionStore,
): Promise<string> {
  const kv = getStore(store)
  const previousSession = await getProtectedSession(previousToken, kv)
  const authorizedRoutes = new Set(previousSession?.authorizedRoutes ?? [])
  authorizedRoutes.add(normalizeRoute(protectedRoute))

  const token = generateRandomOAuthValue()
  const ttl = getSessionTtl()
  const record: ProtectedSessionRecord = {
    version: 1,
    authorizedRoutes: [...authorizedRoutes],
    expiresAt: Date.now() + ttl * 1000,
  }
  await kv.put(sessionKey(token), JSON.stringify(record), { expirationTtl: ttl })

  if (sessionTokenPattern.test(previousToken)) await kv.delete(sessionKey(previousToken))
  return token
}

export async function deleteProtectedSession(token: string, store?: ProtectedSessionStore): Promise<void> {
  if (sessionTokenPattern.test(token)) await getStore(store).delete(sessionKey(token))
}

export async function isProtectedLoginRateLimited(
  clientIp: string,
  protectedRoute: string,
  store?: ProtectedSessionStore,
): Promise<boolean> {
  if (!clientIp) return false
  const raw = await getStore(store).get(failureKey(clientIp, protectedRoute))
  if (!raw) return false
  try {
    return (JSON.parse(raw) as LoginFailureRecord).count >= getLoginAttemptLimit()
  } catch {
    return false
  }
}

export async function recordProtectedLoginFailure(
  clientIp: string,
  protectedRoute: string,
  store?: ProtectedSessionStore,
): Promise<void> {
  if (!clientIp) return
  const kv = getStore(store)
  const key = failureKey(clientIp, protectedRoute)
  let count = 0
  try {
    count = Number((JSON.parse((await kv.get(key)) ?? '') as LoginFailureRecord).count) || 0
  } catch {
    count = 0
  }
  await kv.put(key, JSON.stringify({ count: count + 1 }), { expirationTtl: getLoginWindow() })
}

export async function clearProtectedLoginFailures(
  clientIp: string,
  protectedRoute: string,
  store?: ProtectedSessionStore,
): Promise<void> {
  if (clientIp) await getStore(store).delete(failureKey(clientIp, protectedRoute))
}
