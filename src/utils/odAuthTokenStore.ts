import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { KVNamespace } from '@cloudflare/workers-types'

type OneDriveCloudflareEnv = CloudflareEnv & { CLOUDFLARE_KV: KVNamespace }

export function getOneDriveIndexStore(): KVNamespace {
  return (getCloudflareContext().env as OneDriveCloudflareEnv).CLOUDFLARE_KV
}

export async function getOdAuthTokens(): Promise<{ accessToken: unknown; refreshToken: unknown }> {
  const CLOUDFLARE_KV = getOneDriveIndexStore()

  const accessToken = await CLOUDFLARE_KV.get('access_token')
  const refreshToken = await CLOUDFLARE_KV.get('refresh_token')

  return {
    accessToken,
    refreshToken,
  }
}

export async function storeOdAuthTokens({
  accessToken,
  accessTokenExpiry,
  refreshToken,
}: {
  accessToken: string
  accessTokenExpiry: number
  refreshToken: string
}): Promise<void> {
  const CLOUDFLARE_KV = getOneDriveIndexStore()

  // Expire the cached value one minute before Microsoft does so requests do not race the remote expiry.
  await CLOUDFLARE_KV.put('access_token', accessToken, { expirationTtl: Math.max(60, accessTokenExpiry - 60) })
  await CLOUDFLARE_KV.put('refresh_token', refreshToken)
}
