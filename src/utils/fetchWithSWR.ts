import axios from 'axios'

import useSWRInfinite from 'swr/infinite'

import type { OdAPIResponse } from '../types'

// Common axios fetch function for use with useSWR
export async function fetcher(url: string): Promise<any> {
  try {
    return (await axios.get(url)).data
  } catch (err: any) {
    throw normalizeFetchError(err)
  }
}

export function normalizeFetchError(error: unknown): { status: number; message: any } {
  if (axios.isAxiosError(error)) {
    return {
      status: error.response?.status ?? 0,
      message: error.response?.data ?? { error: error.message || 'Network request failed.' },
    }
  }
  return {
    status: 0,
    message: { error: error instanceof Error ? error.message : 'Unexpected request failure.' },
  }
}

/**
 * Paging with useSWRInfinite; protected-route credentials are sent automatically as an HttpOnly cookie.
 * @param path Current query directory path
 * @returns useSWRInfinite API
 */
export function useProtectedSWRInfinite(path: string = '') {
  /**
   * Next page infinite loading for useSWR
   * @param pageIdx The index of this paging collection
   * @param prevPageData Previous page information
   * @param path Directory path
   * @returns API to the next page
   */
  function getNextKey(pageIndex: number, previousPageData: OdAPIResponse): string | null {
    // Reached the end of the collection
    if (previousPageData && !previousPageData.folder) return null

    // First page with no prevPageData
    if (pageIndex === 0) return `/api?path=${path}`

    // Add nextPage token to API endpoint
    return `/api?path=${path}&next=${previousPageData.next}`
  }

  // Disable auto-revalidate, these options are equivalent to useSWRImmutable
  // https://swr.vercel.app/docs/revalidation#disable-automatic-revalidations
  const revalidationOptions = {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  }
  return useSWRInfinite(getNextKey, fetcher, revalidationOptions)
}
