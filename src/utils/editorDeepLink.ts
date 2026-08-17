/** Deep-link from planogram catalog into the 3D editor (`/`). */

export type EditorDeepLinkParams = {
  storeId: string
  storeName?: string | null
  rackId?: string | null
  shelfId?: string | null
}

export function buildEditorUrl(params: EditorDeepLinkParams): string {
  const qs = new URLSearchParams()
  qs.set('storeId', params.storeId)
  if (params.rackId) qs.set('rackId', params.rackId)
  if (params.shelfId) qs.set('shelfId', params.shelfId)
  if (params.storeName?.trim()) qs.set('storeName', params.storeName.trim())
  return `/?${qs.toString()}`
}

export function parseEditorDeepLink(search: string): EditorDeepLinkParams | null {
  const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const storeId = qs.get('storeId')?.trim()
  if (!storeId) return null
  return {
    storeId,
    storeName: qs.get('storeName'),
    rackId: qs.get('rackId'),
    shelfId: qs.get('shelfId'),
  }
}

/** Match editor rack by server rack id or local id. */
export function findRackByLinkId(
  racks: Array<{ id: string; rackId?: string | null }>,
  linkRackId: string,
): { id: string; rackId?: string | null } | null {
  const needle = linkRackId.trim()
  if (!needle) return null
  return (
    racks.find((r) => r.rackId === needle || r.id === needle) ??
    null
  )
}
