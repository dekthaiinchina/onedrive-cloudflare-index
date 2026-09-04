import axios from 'redaxios'

import { encodePath, getAccessToken, getAuthTokenPath } from '.'
import apiConfig from '../../../config/api.config'
import siteConfig from '../../../config/site.config'
import { NextRequest, NextResponse } from 'next/server'
import { encodeDrivePathForUrl, getRelativeDrivePath } from '../../utils/oneDrivePath'
import { nodeApiHandler } from '../../utils/nodeApiHandler'

/**
 * Sanitize the search query
 *
 * @param query User search query, which may contain special characters
 * @returns Sanitised query string, which:
 * - encodes the '<' and '>' characters,
 * - replaces '?' and '/' characters with ' ',
 * - replaces ''' with ''''
 * Reference: https://stackoverflow.com/questions/41491222/single-quote-escaping-in-microsoft-graph.
 */
function sanitiseQuery(query: string): string {
  const sanitisedQuery = query
    .replace(/'/g, "''")
    .replace('<', ' &lt; ')
    .replace('>', ' &gt; ')
    .replace('?', ' ')
    .replace('/', ' ')
  return encodeURIComponent(sanitisedQuery)
}

async function webHandler(req: NextRequest): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { Allow: 'GET' } })
  }

  // Get access token from storage
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No access token.' }), { status: 403 })
  }

  // Query parameter from request
  const { q: searchQuery = '' } = Object.fromEntries(req.nextUrl.searchParams)

  // TODO: Set edge function caching for faster load times

  if (typeof searchQuery === 'string') {
    // Construct Microsoft Graph Search API URL, and perform search only under the base directory
    const searchRootPath = encodePath('/')
    const encodedPath = searchRootPath === '' ? searchRootPath : searchRootPath + ':'

    const searchApi = `${apiConfig.driveApi}/root${encodedPath}/search(q='${sanitiseQuery(searchQuery)}')`

    try {
      const { data } = await axios.get(searchApi, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          select: 'id,name,file,folder,parentReference',
          $top: siteConfig.maxItems,
        },
      })

      const results = await Promise.all(
        data.value.map(async (item: any) => {
          if (item.parentReference?.path) return item

          const { data: resolved } = await axios.get(`${apiConfig.driveApi}/items/${item.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { select: 'id,name,file,folder,parentReference' },
          })
          return { ...item, parentReference: resolved.parentReference }
        }),
      )

      // Search never returns protected-route metadata. Users can still browse protected paths after authenticating normally.
      const visibleResults = results.flatMap(item => {
        if (item.name?.toLowerCase() === '.password' || !item.parentReference?.path) return []
        const itemPath = getRelativeDrivePath(item.parentReference.path, item.name, siteConfig.baseDirectory)
        if (itemPath === null || getAuthTokenPath(itemPath) !== '') return []
        return [{ ...item, path: encodeDrivePathForUrl(itemPath) }]
      })

      return NextResponse.json(visibleResults, {
        headers: {
          'Cache-Control': apiConfig.cacheControlHeader,
        },
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error?.response?.data ?? 'Internal server error.' }), {
        status: error?.response?.status ?? 500,
      })
    }
  } else {
    return NextResponse.json([])
  }
}

export default nodeApiHandler(webHandler)
