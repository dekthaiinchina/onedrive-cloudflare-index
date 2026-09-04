import { posix as pathPosix } from 'path-browserify'
import axios from 'redaxios'

import { driveApi, cacheControlHeader } from '../../../config/api.config'
import { encodePath, getAccessToken, checkAuthRoute } from '.'
import { NextRequest } from 'next/server'
import { isProxyRequested } from '../../utils/oneDrivePath'
import { nodeApiHandler } from '../../utils/nodeApiHandler'
import { getSafeGraphContentUrl } from '../../utils/safeUrls'
import { createProxiedResponseHeaders } from '../../utils/proxyResponse'
import siteConfig from '../../../config/site.config'
import { getProtectedSessionToken } from '../../utils/protectedSession'

export async function webHandler(req: NextRequest): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Range',
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { ...corsHeaders, Allow: 'GET, OPTIONS' },
    })
  }

  const accessToken = await getAccessToken()
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No access token.' }), { status: 403 })
  }

  const { path = '/', proxy = false } = Object.fromEntries(req.nextUrl.searchParams)

  // Sometimes the path parameter is defaulted to '[...path]' which we need to handle
  if (path === '[...path]') {
    return new Response(JSON.stringify({ error: 'No path specified.' }), { status: 400 })
  }
  // If the path is not a valid path, return 400
  if (typeof path !== 'string') {
    return new Response(JSON.stringify({ error: 'Path query invalid.' }), { status: 400 })
  }
  const cleanPath = pathPosix.resolve('/', pathPosix.normalize(path))

  // Handle protected routes authentication
  const { code, message } = await checkAuthRoute(cleanPath, getProtectedSessionToken(req))
  // Status code other than 200 means user has not authenticated yet
  if (code !== 200) {
    return new Response(JSON.stringify({ error: message }), {
      status: code,
      headers: { ...corsHeaders, 'Cache-Control': 'private, no-store, max-age=0' },
    })
  }

  const headers: Record<string, string> = {
    'Cache-Control': cacheControlHeader,
    ...corsHeaders,
  }

  // If message is empty, then the path is not protected.
  // Conversely, protected routes are not allowed to serve from cache.
  if (message !== '') {
    headers['Cache-Control'] = 'private, no-store, max-age=0'
  }

  try {
    // Handle response from OneDrive API
    const requestUrl = `${driveApi}/root${encodePath(cleanPath)}`
    const { data } = await axios.get(requestUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        // OneDrive international version fails when only selecting the downloadUrl (what a stupid bug)
        select: 'id,size,@microsoft.graph.downloadUrl',
      },
    })

    if ('@microsoft.graph.downloadUrl' in data) {
      const downloadUrl = getSafeGraphContentUrl(data['@microsoft.graph.downloadUrl'])
      if (!downloadUrl) {
        return new Response(JSON.stringify({ error: 'Invalid download URL returned by OneDrive.' }), {
          status: 502,
          headers,
        })
      }

      // Only proxy raw file content response for files up to 4MB
      if (
        isProxyRequested(proxy) &&
        typeof data.size === 'number' &&
        data.size >= 0 &&
        data.size <= siteConfig.maxPreviewSize
      ) {
        const upstreamHeaders = new Headers()
        const range = req.headers.get('range')
        if (range) upstreamHeaders.set('Range', range)

        const upstream = await fetch(downloadUrl, { headers: upstreamHeaders })
        const responseHeaders = createProxiedResponseHeaders(upstream.headers, headers)
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: responseHeaders,
        })
      } else {
        headers['Location'] = downloadUrl
        return new Response(null, { status: 302, headers: headers })
      }
    } else {
      return new Response(JSON.stringify({ error: 'No download url found.' }), { status: 404, headers: headers })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.response?.data ?? 'Internal server error.' }), {
      status: error?.response?.status ?? 500,
      headers: headers,
    })
  }
}

export default nodeApiHandler(webHandler)
