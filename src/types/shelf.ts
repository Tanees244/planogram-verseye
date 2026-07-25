/** Shelf / planogram catalog row from GET /api/v1/layout/shelves */

export interface ShelfListItem {
  id: string
  storeId: string
  name: string
  sortOrder?: number
  categoryId?: string | null
  shelfType?: number | string | null
  isActive?: boolean
  rackSideId?: string | null
  rackId?: string | null
  rackCode?: string | null
  sideCode?: string | null
  fixtureType?: string | null
  publishedAt?: string | null
  lastUpdated?: string | null
  hasLayout?: boolean
  hasPlanogram?: boolean
  /** True when an ideal planogram image is stored for this shelf. */
  hasIdealImage?: boolean
  /** True when the shelf is considered fully configured (layout + ideal image). */
  isConfigured?: boolean
}

export type ShelfDetail = ShelfListItem & {
  description?: string | null
  rows?: unknown[]
  images?: unknown[]
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
