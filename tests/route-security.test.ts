import assert from 'node:assert/strict'
import test from 'node:test'

import { getNextPageToken, getRelativeDrivePath, isProxyRequested } from '../src/utils/oneDrivePath.ts'
import { decodeBrowserRoutePath, findProtectedRoute } from '../src/utils/protectedRoutes.ts'

test('protected routes match complete path components and prefer the most specific route', () => {
  const routes = ['/private', '/private/team files']

  assert.equal(findProtectedRoute('/private/file.txt', routes), '/private')
  assert.equal(findProtectedRoute('/private/team files/report.pdf', routes), '/private/team files')
  assert.equal(findProtectedRoute('/private-sector/report.pdf', routes), '')
})

test('protected-route matching does not decode an already-decoded drive path twice', () => {
  assert.equal(findProtectedRoute('/private/%2e%2e/public/report.pdf', ['/private']), '/private')
  assert.equal(decodeBrowserRoutePath('/private/%252e%252e/public/report.pdf?download=1'), '/private/%2e%2e/public/report.pdf')
})

test('Graph paths are converted relative to the configured share root', () => {
  assert.equal(getRelativeDrivePath('/drive/root:/Shared/Books', 'example.epub', '/Shared'), '/Books/example.epub')
  assert.equal(getRelativeDrivePath('/drive/root:/Unshared', 'secret.txt', '/Shared'), null)
})

test('pagination tokens are parsed without swallowing later query parameters', () => {
  assert.equal(getNextPageToken('https://graph.microsoft.com/items?$skiptoken=abc%2B123&$select=name'), 'abc+123')
})

test('raw proxy mode only accepts explicit true values', () => {
  assert.equal(isProxyRequested('true'), true)
  assert.equal(isProxyRequested('1'), true)
  assert.equal(isProxyRequested('false'), false)
  assert.equal(isProxyRequested(false), false)
})
