import siteConfig from '../../config/site.config.js'
import { decodeBrowserRoutePath, findProtectedRoute } from './protectedRoutes.ts'
/**
 * Match the specified route against a list of predefined routes
 * @param route directory path
 * @returns whether the directory is protected
 */

export function matchProtectedRoute(route: string): string {
  return findProtectedRoute(decodeBrowserRoutePath(route), siteConfig.protectedRoutes)
}
