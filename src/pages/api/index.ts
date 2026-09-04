import { posix as pathPosix } from 'path-browserify'

import axios from 'redaxios'

import apiConfig from '../../../config/api.config'
import siteConfig from '../../../config/site.config'
import { compareProtectedPassword } from '../../utils/protectedPassword'
import { getOdAuthTokens, storeOdAuthTokens } from '../../utils/odAuthTokenStore'
import { getNextPageToken } from '../../utils/oneDrivePath'
import { findProtectedRoute } from '../../utils/protectedRoutes'
import { nodeApiHandler } from '../../utils/nodeApiHandler'
import { getSafeGraphContentUrl } from '../../utils/safeUrls'
import { getProtectedSessionToken, isProtectedSessionAuthorized } from '../../utils/protectedSession'
import { NextRequest, NextResponse } from 'next/server'

const basePath = pathPosix.resolve('/', siteConfig.baseDirectory)

function getOAuthClientSecret(): string {
  const clientSecret = process.env.OAUTH_CLIENT_SECRET
  if (!clientSecret) {
    throw new Error('OAUTH_CLIENT_SECRET is not configured.')
  }
  return clientSecret
}

/**
 * Encode the path of the file relative to the base directory
 *
 * @param path Relative path of the file to the base directory
 * @returns Absolute path of the file inside OneDrive
 */
export function encodePath(path: string): string {
  let encodedPath = pathPosix.join(basePath, path)
  if (encodedPath === '/' || encodedPath === '') {
    return ''
  }
  encodedPath = encodedPath.replace(/\/$/, '')
  return `:${encodeURIComponent(encodedPath)}`
}

/**
 * Fetch the access token from Redis storage and check if the token requires a renew
 *
 * @returns Access token for OneDrive API
 */
export async function getAccessToken(): Promise<string> {
  const { accessToken, refreshToken } = await getOdAuthTokens()

  // Return in storage access token if it is still valid
  if (typeof accessToken === 'string') {
    console.log('Fetch access token from storage.')
    return accessToken
  }

  // Return empty string if no refresh token is stored, which requires the application to be re-authenticated
  if (typeof refreshToken !== 'string') {
    console.log('No refresh token, return empty access token.')
    return ''
  }

  // Fetch new access token with in storage refresh token
  const body = new URLSearchParams()
  body.append('client_id', apiConfig.clientId)
  body.append('redirect_uri', apiConfig.redirectUri)
  body.append('client_secret', getOAuthClientSecret())
  body.append('refresh_token', refreshToken)
  body.append('grant_type', 'refresh_token')

  let resp
  try {
    resp = await axios.post(apiConfig.authApi, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  } catch (error) {
    console.error(
      'Unable to refresh the Microsoft access token.',
      error instanceof Error ? error.message : String(error),
    )
    return ''
  }

  if ('access_token' in resp.data) {
    const { expires_in, access_token } = resp.data
    const nextRefreshToken = typeof resp.data.refresh_token === 'string' ? resp.data.refresh_token : refreshToken
    const accessTokenExpiry = Number.parseInt(expires_in, 10)
    if (!access_token || !Number.isFinite(accessTokenExpiry) || accessTokenExpiry <= 0) return ''
    await storeOdAuthTokens({
      accessToken: access_token,
      accessTokenExpiry,
      refreshToken: nextRefreshToken,
    })
    console.log('Fetch new access token with stored refresh token.')
    return access_token
  }

  return ''
}

/**
 * Match protected routes in site config to get path to required auth token
 * @param path Path cleaned in advance
 * @returns Path to required auth token. If not required, return empty string.
 */
export function getAuthTokenPath(path: string) {
  const match = getProtectedRoute(path)
  return match ? pathPosix.join(match, '.password') : ''
}

export function getProtectedRoute(path: string): string {
  return findProtectedRoute(path, siteConfig.protectedRoutes)
}

export function getCacheControlForRoute(authMessage: string): string {
  return authMessage ? 'private, no-store, max-age=0' : apiConfig.cacheControlHeader
}

/**
 * Authorize a protected drive path using an opaque server-side session.
 */
export async function checkAuthRoute(
  cleanPath: string,
  sessionToken: string,
): Promise<{ code: 200 | 401 | 404 | 500; message: string }> {
  const protectedRoute = getProtectedRoute(cleanPath)
  if (!protectedRoute) return { code: 200, message: '' }
  if (await isProtectedSessionAuthorized(sessionToken, protectedRoute)) {
    return { code: 200, message: 'Authenticated.' }
  }
  return { code: 401, message: 'Password required.' }
}

/** Validate a submitted password once before creating an opaque protected-route session. */
export async function verifyProtectedRoutePassword(
  cleanPath: string,
  accessToken: string,
  submittedPassword: string,
): Promise<{ code: 200 | 401 | 404 | 500; message: string; protectedRoute: string }> {
  const protectedRoute = getProtectedRoute(cleanPath)
  const authTokenPath = protectedRoute ? pathPosix.join(protectedRoute, '.password') : ''
  if (!authTokenPath) return { code: 404, message: 'Protected route not found.', protectedRoute: '' }

  try {
    const token = await axios.get(`${apiConfig.driveApi}/root${encodePath(authTokenPath)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        select: '@microsoft.graph.downloadUrl,file,size',
      },
    })

    if (typeof token.data.size !== 'number' || token.data.size < 0 || token.data.size > 4096) {
      return { code: 500, message: 'Invalid password file.', protectedRoute }
    }
    const passwordUrl = getSafeGraphContentUrl(token.data['@microsoft.graph.downloadUrl'])
    if (!passwordUrl) return { code: 500, message: 'Internal server error.', protectedRoute }
    const odProtectedToken = await axios.get(passwordUrl)
    const dotPassword = typeof odProtectedToken.data === 'string' ? odProtectedToken.data : String(odProtectedToken.data)

    if (
      dotPassword.length > 4096 ||
      !compareProtectedPassword({
        submittedPassword,
        dotPassword,
      })
    ) {
      return { code: 401, message: 'Invalid credentials.', protectedRoute }
    }
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return { code: 404, message: 'Password file not found.', protectedRoute }
    } else {
      return { code: 500, message: 'Internal server error.', protectedRoute }
    }
  }

  return { code: 200, message: 'Authenticated.', protectedRoute }
}

export async function webHandler(req: NextRequest): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
      status: 405,
      headers: { Allow: 'GET' },
    })
  }

  // TODO: Set edge function caching for faster load times

  // If method is GET, then the API is a normal request to the OneDrive API for files or folders
  const { path = '/', next = '', sort = '' } = Object.fromEntries(req.nextUrl.searchParams)

  // Sometimes the path parameter is defaulted to '[...path]' which we need to handle
  if (path === '[...path]') {
    return new Response(JSON.stringify({ error: 'No path specified.' }), { status: 400 })
  }
  // If the path is not a valid path, return 400
  if (typeof path !== 'string') {
    return new Response(JSON.stringify({ error: 'Path query invalid.' }), { status: 400 })
  }
  // Besides normalizing and making absolute, trailing slashes are trimmed
  const cleanPath = pathPosix.resolve('/', pathPosix.normalize(path)).replace(/\/$/, '')

  // Validate sort param
  if (typeof sort !== 'string') {
    return new Response(JSON.stringify({ error: 'Sort query invalid.' }), { status: 400 })
  }

  const accessToken = await getAccessToken()

  // Return error 403 if access_token is empty
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'No access token.' }), { status: 403 })
  }

  // Handle protected routes authentication
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

  // Querying current path identity (file or folder) and follow up query childrens in folder
  try {
    const { data: identityData } = await axios.get(requestUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        select: 'name,size,id,lastModifiedDateTime,folder,file,video,image',
      },
    })

    if ('folder' in identityData) {
      const { data: folderData } = await axios.get(`${requestUrl}${isRoot ? '' : ':'}/children`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          ...{
            select: 'name,size,id,lastModifiedDateTime,folder,file,video,image',
            $top: siteConfig.maxItems,
          },
          ...(next ? { $skipToken: next } : {}),
          ...(sort ? { $orderby: sort } : {}),
        },
      })

      // Extract next page token from full @odata.nextLink
      folderData.value = folderData.value.filter((item: { name?: string }) => item.name?.toLowerCase() !== '.password')
      const nextPage = getNextPageToken(folderData['@odata.nextLink'])

      // Return paging token if specified
      if (nextPage) {
        return NextResponse.json(
          { folder: folderData, next: nextPage },
          {
            headers: {
              'Cache-Control': getCacheControlForRoute(message),
            },
          },
        )
      } else {
        return NextResponse.json(
          { folder: folderData },
          {
            headers: {
              'Cache-Control': getCacheControlForRoute(message),
            },
          },
        )
      }
    }
    return NextResponse.json(
      { file: identityData },
      {
        headers: {
          'Cache-Control': getCacheControlForRoute(message),
        },
      },
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.response?.data ?? 'Internal server error.' }), {
      status: error?.response?.status ?? 500,
      headers: { 'Cache-Control': getCacheControlForRoute(message) },
    })
  }
}

export default nodeApiHandler(webHandler)
