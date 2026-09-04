import pathBrowserify from 'path-browserify'

const { posix: pathPosix } = pathBrowserify

/** Decode one browser URL pathname layer before comparing it with decoded drive paths. */
export function decodeBrowserRoutePath(route: string): string {
  const path = route.split(/[?#]/, 1)[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** Return the most-specific configured protected route matching an already-decoded drive path. */
export function findProtectedRoute(route: string, protectedRoutes: unknown[]): string {
  const normalizedRoute = pathPosix.resolve('/', route).toLowerCase()

  return (
    protectedRoutes
      .filter((candidate): candidate is string => typeof candidate === 'string' && candidate !== '')
      .map(original => ({ original, normalized: pathPosix.resolve('/', original).toLowerCase() }))
      .filter(({ normalized }) => normalizedRoute === normalized || normalizedRoute.startsWith(`${normalized}/`))
      .sort((a, b) => b.normalized.length - a.normalized.length)[0]?.original ?? ''
  )
}
