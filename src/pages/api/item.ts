import axios from 'redaxios'

import { checkAuthRoute, getAccessToken } from '.'
import apiConfig from '../../../config/api.config'
import siteConfig from '../../../config/site.config'
import { NextRequest, NextResponse } from 'next/server'
import { getRelativeDrivePath } from '../../utils/oneDrivePath'
import { nodeApiHandler } from '../../utils/nodeApiHandler'
import { getProtectedSessionToken } from '../../utils/protectedSession'

async function webHandler(req: NextRequest): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { Allow: 'GET' } })
  }

  // Get access token from storage
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No access token.' }), { status: 403 })
  }

  // Get item details (specifically, its path) by its unique ID in OneDrive
  const { id = '' } = Object.fromEntries(req.nextUrl.searchParams)

  // TODO: Set edge function caching for faster load times

  if (typeof id === 'string') {
    const idPattern = /^[a-zA-Z0-9]+$/
    if (!idPattern.test(id)) {
      // ID contains characters other than letters and numbers
      return new Response(JSON.stringify({ error: 'Invalid driveItem ID.' }), { status: 400 })
    }

    const itemApi = `${apiConfig.driveApi}/items/${id}`
    try {
      const { data } = await axios.get(itemApi, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          select: 'id,name,parentReference',
        },
      })

      const itemPath = getRelativeDrivePath(data.parentReference?.path ?? '', data.name, siteConfig.baseDirectory)
      if (itemPath === null) {
        return new Response(JSON.stringify({ error: 'Drive item is outside the shared directory.' }), { status: 404 })
      }

      const { code, message } = await checkAuthRoute(itemPath, getProtectedSessionToken(req))
      if (code !== 200) {
        return new Response(JSON.stringify({ error: message }), {
          status: code,
          headers: { 'Cache-Control': 'private, no-store, max-age=0' },
        })
      }

      return NextResponse.json(data, {
        headers: {
          'Cache-Control': message ? 'private, no-store, max-age=0' : apiConfig.cacheControlHeader,
        },
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error?.response?.data ?? 'Internal server error.' }), {
        status: error?.response?.status ?? 500,
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      })
    }
  } else {
    return new Response(JSON.stringify({ error: 'Invalid driveItem ID.' }), { status: 400 })
  }
}

export default nodeApiHandler(webHandler)
