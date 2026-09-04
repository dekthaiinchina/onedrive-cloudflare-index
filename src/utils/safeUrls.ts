/** Parse an external URL while excluding scriptable and credential-bearing schemes. */
export function getSafeExternalHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 8192) return null

  try {
    const url = new URL(value.trim())
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Microsoft Graph download and thumbnail URLs must always use transport encryption. */
export function getSafeGraphContentUrl(value: unknown): string | null {
  const url = getSafeExternalHttpUrl(value)
  return url?.startsWith('https://') ? url : null
}

/** Extract the URL from a Windows Internet Shortcut without accepting active URL schemes. */
export function parseInternetShortcut(content: string): string | null {
  const value = content
    .split(/\r?\n/)
    .map(line => /^\s*URL\s*=(.*)$/i.exec(line)?.[1])
    .find((candidate): candidate is string => candidate !== undefined)

  return getSafeExternalHttpUrl(value)
}
