import assert from 'node:assert/strict'
import test from 'node:test'

import { compareProtectedPassword } from '../src/utils/protectedPassword.ts'
import {
  clearProtectedSessionCookie,
  createProtectedSession,
  deleteProtectedSession,
  getProtectedSession,
  getProtectedSessionToken,
  isProtectedLoginRateLimited,
  isProtectedSessionAuthorized,
  recordProtectedLoginFailure,
  serializeProtectedSessionCookie,
  type ProtectedSessionStore,
} from '../src/utils/protectedSession.ts'
import { NextRequest } from 'next/server.js'

class MemorySessionStore {
  readonly values = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key)
  }
}

test('protected sessions authorize routes without storing the bearer token as a KV key', async () => {
  const store = new MemorySessionStore()
  const token = await createProtectedSession('/Private', '', store as ProtectedSessionStore)

  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(await isProtectedSessionAuthorized(token, '/private', store as ProtectedSessionStore), true)
  assert.equal(await isProtectedSessionAuthorized(token, '/other', store as ProtectedSessionStore), false)
  assert.equal([...store.values.keys()].some(key => key.includes(token)), false)
})

test('extending authorization rotates and revokes the previous session token', async () => {
  const store = new MemorySessionStore()
  const first = await createProtectedSession('/private', '', store as ProtectedSessionStore)
  const second = await createProtectedSession('/team', first, store as ProtectedSessionStore)

  assert.notEqual(second, first)
  assert.equal(await getProtectedSession(first, store as ProtectedSessionStore), null)
  assert.equal(await isProtectedSessionAuthorized(second, '/private', store as ProtectedSessionStore), true)
  assert.equal(await isProtectedSessionAuthorized(second, '/team', store as ProtectedSessionStore), true)

  await deleteProtectedSession(second, store as ProtectedSessionStore)
  assert.equal(await getProtectedSession(second, store as ProtectedSessionStore), null)
})

test('protected session cookies are HttpOnly, same-site, and secure when requested', () => {
  const cookie = serializeProtectedSessionCookie('token', true)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Strict/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /Path=\//)
  assert.match(clearProtectedSessionCookie(true), /Max-Age=0/)
  const token = 'a'.repeat(43)
  const request = new NextRequest('https://files.example.test/api', {
    headers: { Cookie: `od-protected-session=${token}` },
  })
  assert.equal(getProtectedSessionToken(request), token)
  assert.equal(getProtectedSessionToken(new NextRequest(`https://files.example.test/api?odpt=${'b'.repeat(64)}`)), '')
})

test('password comparison does not accept a password hash as the password', () => {
  assert.equal(compareProtectedPassword({ submittedPassword: 'correct horse', dotPassword: 'correct horse\n' }), true)
  assert.equal(compareProtectedPassword({ submittedPassword: 'wrong', dotPassword: 'correct horse' }), false)
})

test('repeated protected login failures are rate limited', async () => {
  const store = new MemorySessionStore()
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await recordProtectedLoginFailure('203.0.113.10', '/private', store as ProtectedSessionStore)
  }
  assert.equal(await isProtectedLoginRateLimited('203.0.113.10', '/private', store as ProtectedSessionStore), true)
  assert.equal(await isProtectedLoginRateLimited('203.0.113.11', '/private', store as ProtectedSessionStore), false)
})
