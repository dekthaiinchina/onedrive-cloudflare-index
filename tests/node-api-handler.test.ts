import assert from 'node:assert/strict'
import test from 'node:test'

import { nodeApiHandler } from '../src/utils/nodeApiHandler.ts'

test('nodeApiHandler preserves the Web API request and response contract', async () => {
  const handler = nodeApiHandler(async request => {
    assert.equal(request.method, 'POST')
    assert.equal(request.nextUrl.toString(), 'https://files.example.test/api/oauth?step=2')
    assert.equal(request.headers.get('x-test'), 'request-header')
    assert.deepEqual(await request.json(), { redirectedUrl: 'http://localhost/?code=test' })

    return new Response('stored', {
      status: 201,
      headers: {
        'Set-Cookie': 'oauth=complete; HttpOnly',
        'X-Test': 'response-header',
      },
    })
  })

  const responseHeaders = new Map<string, string | string[]>()
  let responseStatus = 0
  let responseBody: Buffer | undefined
  const response = {
    setHeader(name: string, value: string | string[]) {
      responseHeaders.set(name.toLowerCase(), value)
    },
    status(status: number) {
      responseStatus = status
      return this
    },
    send(body: Buffer) {
      responseBody = body
      return this
    },
    end() {
      return this
    },
  }

  await handler(
    {
      method: 'POST',
      url: '/api/oauth?step=2',
      headers: {
        host: 'files.example.test',
        'x-forwarded-host': 'attacker.example.test',
        'x-forwarded-proto': 'https',
        'content-type': 'application/json',
        'x-test': 'request-header',
      },
      body: { redirectedUrl: 'http://localhost/?code=test' },
    } as never,
    response as never,
  )

  assert.equal(responseStatus, 201)
  assert.equal(responseHeaders.get('x-test'), 'response-header')
  assert.deepEqual(responseHeaders.get('set-cookie'), ['oauth=complete; HttpOnly'])
  assert.equal(responseBody?.toString(), 'stored')
})
