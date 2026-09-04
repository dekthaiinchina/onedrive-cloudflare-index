const safeUpstreamResponseHeaders = [
  'accept-ranges',
  'content-disposition',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
] as const

/** Copy only representation metadata; never let an upstream host set app-origin cookies or security policy. */
export function createProxiedResponseHeaders(
  upstreamHeaders: Headers,
  applicationHeaders: Record<string, string>,
): Headers {
  const headers = new Headers(applicationHeaders)
  safeUpstreamResponseHeaders.forEach(name => {
    const value = upstreamHeaders.get(name)
    if (value !== null) headers.set(name, value)
  })
  return headers
}
