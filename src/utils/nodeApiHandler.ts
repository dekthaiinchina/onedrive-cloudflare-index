import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { NextRequest } from 'next/server.js'

type WebApiHandler = (request: NextRequest) => Promise<Response>

const firstHeader = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const forwardedProtocol = (value: string | string[] | undefined): 'http' | 'https' => {
  const protocol = firstHeader(value)
    ?.split(',')
    .at(-1)
    ?.trim()
    .toLowerCase()
  return protocol === 'https' ? 'https' : 'http'
}

function toNextRequest(req: NextApiRequest): NextRequest {
  const protocol = forwardedProtocol(req.headers['x-forwarded-proto'])
  // The Host header represents the request target. Do not let a client-supplied forwarded host rewrite generated URLs.
  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url ?? '/', `${protocol}://${host}`)
  const headers = new Headers()

  Object.entries(req.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach(item => headers.append(name, item))
    else if (value !== undefined) headers.set(name, value)
  })

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined
  const body = hasBody ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined
  return new NextRequest(url, { method: req.method, headers, body })
}

async function sendWebResponse(response: Response, res: NextApiResponse): Promise<void> {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  headers.forEach((value, name) => {
    if (name !== 'set-cookie') res.setHeader(name, value)
  })

  const cookies = headers.getSetCookie?.()
  if (cookies?.length) res.setHeader('set-cookie', cookies)
  else if (headers.has('set-cookie')) res.setHeader('set-cookie', headers.get('set-cookie')!)

  res.status(response.status)
  if (!response.body) {
    res.end()
    return
  }

  res.send(Buffer.from(await response.arrayBuffer()))
}

export function nodeApiHandler(handler: WebApiHandler): NextApiHandler {
  return async (req, res) => {
    await sendWebResponse(await handler(toNextRequest(req)), res)
  }
}
