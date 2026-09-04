import type { OdThumbnail } from '../../types'

import { posix as pathPosix } from 'path-browserify'
import axios from 'redaxios'

import { checkAuthRoute, encodePath, getAccessToken } from '.'
import apiConfig from '../../../config/api.config'
import { NextRequest } from 'next/server'
import { nodeApiHandler } from '../../utils/nodeApiHandler'
import { getSafeGraphContentUrl } from '../../utils/safeUrls'
import { getProtectedSessionToken } from '../../utils/protectedSession'

async function webHandler(req: NextRequest): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { Allow: 'GET' } })
  }

  const accessToken = await getAccessToken()

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No access token.' }), { status: 403 })
  }

  // Get item thumbnails by its path since we will later check if it is protected
  const { path = '', size = 'medium' } = Object.fromEntries(req.nextUrl.searchParams)

  // Check whether the size is valid - must be one of 'large', 'medium', or 'small'
  if (size !== 'large' && size !== 'medium' && size !== 'small') {
    return new Response(JSON.stringify({ error: 'Invalid size.' }), { status: 400 })
  }
  // Sometimes the path parameter is defaulted to '[...path]' which we need to handle
  if (path === '[...path]') {
    return new Response(JSON.stringify({ error: 'No path specified.' }), { status: 400 })
  }
  // If the path is not a valid path, return 400
  if (typeof path !== 'string') {
    return new Response(JSON.stringify({ error: 'Path query invalid.' }), { status: 400 })
  }
  const cleanPath = pathPosix.resolve('/', pathPosix.normalize(path))

  const { code, message } = await checkAuthRoute(cleanPath, getProtectedSessionToken(req))
  // Status code other than 200 means user has not authenticated yet
  if (code !== 200) {
    return new Response(JSON.stringify({ error: message }), {
      status: code,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  }
  const requestPath = encodePath(cleanPath)
  // Handle response from OneDrive API
  const requestUrl = `${apiConfig.driveApi}/root${requestPath}`
  // Whether path is root, which requires some special treatment
  const isRoot = requestPath === ''

  try {
    const { data } = await axios.get(`${requestUrl}${isRoot ? '' : ':'}/thumbnails`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const thumbnailUrl = getSafeGraphContentUrl(
      data.value && data.value.length > 0 ? (data.value[0] as OdThumbnail)[size]?.url : null,
    )
    if (thumbnailUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: thumbnailUrl,
          'Cache-Control': message ? 'private, no-store, max-age=0' : apiConfig.cacheControlHeader,
        },
      })
    } else {
      return new Response(JSON.stringify({ error: "The item doesn't have a valid thumbnail." }), { status: 400 })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.response?.data ?? 'Internal server error.' }), {
      status: error?.response?.status,
      headers: { 'Cache-Control': message ? 'private, no-store, max-age=0' : apiConfig.cacheControlHeader },
    })
  }
}

export default nodeApiHandler(webHandler)
