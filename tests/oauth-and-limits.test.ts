import assert from 'node:assert/strict'
import test from 'node:test'

import { addArchiveEntrySize } from '../src/utils/downloadLimits.ts'
import { extractOAuthResponse, generatePkceChallenge, generateRandomOAuthValue } from '../src/utils/oauthSecurity.ts'
import { encodeDrivePathForUrl } from '../src/utils/oneDrivePath.ts'
import { getSafeGraphContentUrl, parseInternetShortcut } from '../src/utils/safeUrls.ts'
import { createProxiedResponseHeaders } from '../src/utils/proxyResponse.ts'

test('OAuth redirects must match the configured redirect origin and path', () => {
  const valid = extractOAuthResponse('http://localhost/?code=secret&state=expected', 'http://localhost')
  assert.deepEqual(valid, { code: 'secret', state: 'expected', error: '', errorDescription: '' })

  const deceptive = extractOAuthResponse('http://localhost.example/?code=secret&state=expected', 'http://localhost')
  assert.equal(deceptive.code, '')
  assert.equal(deceptive.error, 'invalid_redirect')
})

test('PKCE uses RFC 7636 compatible SHA-256 base64url encoding', async () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
  assert.equal(await generatePkceChallenge(verifier), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  assert.match(generateRandomOAuthValue(), /^[A-Za-z0-9_-]{43}$/)
})

test('drive paths encode each name while preserving path separators', () => {
  assert.equal(encodeDrivePathForUrl('/Books/A #1/100%.pdf'), '/Books/A%20%231/100%25.pdf')
})

test('archive size accounting rejects entries beyond the configured maximum', () => {
  assert.equal(addArchiveEntrySize(10, 20, 30), 30)
  assert.throws(() => addArchiveEntrySize(30, 1, 30), /Archive size limit exceeded/)
})

test('internet shortcuts allow only non-credentialed HTTP(S) URLs', () => {
  assert.equal(parseInternetShortcut('[InternetShortcut]\r\nURL=https://example.com/a?x=1&y=2'), 'https://example.com/a?x=1&y=2')
  assert.equal(parseInternetShortcut('[InternetShortcut]\nURL=javascript:alert(document.domain)'), null)
  assert.equal(parseInternetShortcut('[InternetShortcut]\nURL=https://user:pass@example.com/'), null)
  assert.equal(getSafeGraphContentUrl('http://example.com/file'), null)
})

test('proxied file responses do not inherit cookies or security headers from upstream', () => {
  const upstream = new Headers({
    'Content-Type': 'text/plain',
    'Set-Cookie': 'attacker=value',
    'Content-Security-Policy': "default-src *",
    Location: 'https://attacker.example/',
  })
  const headers = createProxiedResponseHeaders(upstream, { 'Cache-Control': 'no-store' })

  assert.equal(headers.get('content-type'), 'text/plain')
  assert.equal(headers.get('cache-control'), 'no-store')
  assert.equal(headers.get('set-cookie'), null)
  assert.equal(headers.get('content-security-policy'), null)
  assert.equal(headers.get('location'), null)
})
