/** Shelf / planogram catalog row from GET /api/v1/layout/shelves */

export interface ShelfListItem {
  id: string
  storeId: string
  storeName?: string
  name: string
  planogramName?: string | null
  sortOrder?: number
  categoryId?: string | null
  shelfType?: number | string | null
  isActive?: boolean
  rackSideId?: string | null
  rackId?: string | null
  rackCode?: string | null
  /** Linked rack blueprint name (not shelf `name`). */
  rackName?: string | null
  sideCode?: string | null
  fixtureType?: string | null
  publishedAt?: string | null
  lastUpdated?: string | null
  hasLayout?: boolean
  hasPlanogram?: boolean
  /** True when an ideal planogram image is stored for this shelf. */
  hasIdealImage?: boolean
  /** Ideal image + non-empty ideal order JSON. */
  isConfigured?: boolean
}

export type ShelfDetail = ShelfListItem & {
  description?: string | null
  rows?: unknown[]
  images?: unknown[]
}

/** Contract §3 — no draft/published shelf enum. */
export type PlanogramStatusLabel =
  | 'Not linked'
  | 'Layout only'
  | 'Image only'
  | 'Configured'

export function planogramStatusFromShelf(
  item: Pick<
    ShelfListItem,
    'hasLayout' | 'hasIdealImage' | 'isConfigured' | 'rackSideId' | 'rackId'
  >,
): PlanogramStatusLabel {
  const hasLayout =
    item.hasLayout === true || Boolean(item.rackSideId || item.rackId)
  if (!hasLayout) return 'Not linked'
  if (item.isConfigured === true) return 'Configured'
  if (item.hasIdealImage === true) return 'Image only'
  return 'Layout only'
}

export function shelfListRackDisplayName(
  item: Pick<ShelfListItem, 'rackName' | 'rackCode'>,
): string {
  const name = item.rackName?.trim()
  if (name) return name
  const code = item.rackCode?.trim()
  if (code) return code
  return '—'
}

/** Format ISO UTC for planogram tables (date + time). */
export function formatPlanogramDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
