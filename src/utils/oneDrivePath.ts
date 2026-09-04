import pathBrowserify from 'path-browserify'

const { posix: pathPosix } = pathBrowserify

/** Convert a Microsoft Graph parentReference path into a path relative to the configured share root. */
export function getRelativeDrivePath(
  parentReferencePath: string,
  itemName: string,
  baseDirectory: string,
): string | null {
  const markerIndex = parentReferencePath.toLowerCase().indexOf('root:')
  if (markerIndex === -1) return null

  const graphParent = pathPosix.resolve('/', parentReferencePath.slice(markerIndex + 'root:'.length))
  const basePath = pathPosix.resolve('/', baseDirectory)
  const graphParentLower = graphParent.toLowerCase()
  const basePathLower = basePath.toLowerCase()

  if (basePath !== '/' && graphParentLower !== basePathLower && !graphParentLower.startsWith(`${basePathLower}/`)) {
    return null
  }

  const relativeParent = basePath === '/' ? graphParent : graphParent.slice(basePath.length) || '/'
  return pathPosix.resolve('/', relativeParent, itemName)
}

export function getNextPageToken(nextLink?: string): string | null {
  if (!nextLink) return null
  try {
    return new URL(nextLink).searchParams.get('$skiptoken')
  } catch {
    return null
  }
}

export function isProxyRequested(value: unknown): boolean {
  return value === 'true' || value === '1'
}

/** Encode each component of a normalized drive path without encoding its directory separators. */
export function encodeDrivePathForUrl(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}
