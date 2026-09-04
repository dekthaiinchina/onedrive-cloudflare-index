export function addArchiveEntrySize(currentSize: number, entrySize: number, maximumSize: number): number {
  const safeEntrySize = Number.isFinite(entrySize) && entrySize > 0 ? entrySize : 0
  const nextSize = currentSize + safeEntrySize
  if (nextSize > maximumSize) {
    throw new Error(`Archive size limit exceeded (${maximumSize} bytes). Download fewer files at a time.`)
  }
  return nextSize
}
