import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { extractApiErrorMessage } from '@/utils/apiMessages'
import { binOccupiedFacingWidth } from '@/utils/layoutCascade'
import { resolveEntityId, resolveProductFacingId } from '@/utils/storeLayoutLoader'
import type { Rack } from '@/store/planogramStore'

export interface BinInventorySku {
  skuId: string
  skuName: string
  quantity: number
  maxQuantity: number
  /** Facing width in meters when returned by API. */
  width?: number
}

export interface ShelfCapacityInfo {
  binWidthM: number
  facingWidthM: number
  placedFacings: number
  usedWidthM: number
  freeWidthM: number
  maxTotalFacings: number
  remainingFacings: number
  usagePct: number
}

export interface BinInventoryData {
  binId: string
  binName?: string | null
  width: number
  height: number
  depth: number
  sku: BinInventorySku | null
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

function normalizeInventory(raw: unknown): BinInventoryData | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const binId = typeof d.binId === 'string' ? d.binId : ''
  if (!binId) return null

  const skuRaw = d.sku
  let sku: BinInventorySku | null = null
  if (skuRaw && typeof skuRaw === 'object') {
    const s = skuRaw as Record<string, unknown>
    const skuId = typeof s.skuId === 'string' ? s.skuId : typeof s.id === 'string' ? s.id : ''
    if (skuId) {
      const width = Number(s.width ?? s.facingWidth ?? s.skuWidth)
      sku = {
        skuId,
        skuName: typeof s.skuName === 'string' ? s.skuName : typeof s.name === 'string' ? s.name : 'SKU',
        quantity: Math.max(0, Math.floor(Number(s.quantity) || 0)),
        maxQuantity: Math.max(0, Math.floor(Number(s.maxQuantity) || 0)),
        ...(Number.isFinite(width) && width > 0 ? { width } : {}),
      }
    }
  }

  return {
    binId,
    binName: typeof d.binName === 'string' ? d.binName : null,
    width: Number(d.width) || 0,
    height: Number(d.height) || 0,
    depth: Number(d.depth) || 0,
    sku,
  }
}

/** Max facings that fit along bin shelf width (meters). */
export function maxFacingsForShelf(binWidthM: number, facingWidthM: number): number {
  if (!(binWidthM > 0) || !(facingWidthM > 0)) return 0
  // 1e-6 tolerance so an exact-fit facing (e.g. 85 cm on an 85 cm shelf) counts as 1
  return Math.max(0, Math.floor(binWidthM / facingWidthM + 1e-6))
}

/** Find a bin in the loaded store layout. */
export function findBinInLayout(racks: Rack[], binId: string) {
  const target = resolveEntityId(binId)
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        const bin = row.bins.find(
          (b) => b.id === binId || resolveEntityId(b.id) === target,
        )
        if (bin) return bin
      }
    }
  }
  return null
}

/** Resolve facing width (m) for stock already in a bin. */
export function resolveOccupiedFacingWidthM(
  inventory: BinInventoryData | null,
  racks: Rack[],
  binId: string,
): number | null {
  if (!inventory?.sku) return null
  const localBin = findBinInLayout(racks, binId)
  const localProduct = localBin?.products.find((p) => {
    const pid = resolveProductFacingId(p.id)
    return pid === inventory.sku!.skuId || resolveEntityId(p.id) === inventory.sku!.skuId
  })
  if (localProduct && Number(localProduct.width) > 0) {
    return Number(localProduct.width)
  }
  if (inventory.sku.width && inventory.sku.width > 0) {
    return inventory.sku.width
  }
  return null
}

/**
 * Shelf width (m) already occupied by facings in the bin.
 * Prefers real facing width × quantity over API maxQuantity ratios.
 */
export function usedShelfWidthM(
  inventory: BinInventoryData | null,
  options?: {
    facingWidthM?: number | null
    racks?: Rack[]
    binId?: string
  },
): number {
  if (!inventory || !(inventory.width > 0)) return 0

  const localBin =
    options?.racks && options?.binId ? findBinInLayout(options.racks, options.binId) : null
  if (localBin && localBin.products.length > 0) {
    return Math.min(inventory.width, binOccupiedFacingWidth(localBin.products))
  }

  const qty = inventory.sku?.quantity ?? 0
  const facingW =
    options?.facingWidthM ??
    resolveOccupiedFacingWidthM(inventory, options?.racks ?? [], options?.binId ?? inventory.binId)
  if (facingW && facingW > 0 && qty > 0) {
    return Math.min(inventory.width, qty * facingW)
  }

  return 0
}

/** Width-based shelf capacity for one SKU facing size. */
export function computeShelfCapacity(
  binWidthM: number,
  facingWidthM: number,
  placedFacings: number,
  usedWidthM?: number,
): ShelfCapacityInfo | null {
  if (!(binWidthM > 0) || !(facingWidthM > 0)) return null
  const placed = Math.max(0, Math.floor(placedFacings))
  const used =
    usedWidthM != null
      ? Math.min(binWidthM, Math.max(0, usedWidthM))
      : Math.min(binWidthM, placed * facingWidthM)
  const freeWidthM = Math.max(0, binWidthM - used)
  const maxTotalFacings = maxFacingsForShelf(binWidthM, facingWidthM)
  const remainingFacings = remainingFacingsForShelf(binWidthM, facingWidthM, used)
  const usagePct = Math.min(100, (used / binWidthM) * 100)
  return {
    binWidthM,
    facingWidthM,
    placedFacings: placed,
    usedWidthM: used,
    freeWidthM,
    maxTotalFacings,
    remainingFacings,
    usagePct,
  }
}

/** Max NEW facings of the given width that fit in the remaining shelf space. */
export function remainingFacingsForShelf(
  binWidthM: number,
  facingWidthM: number,
  usedWidthM = 0,
): number {
  return maxFacingsForShelf(Math.max(0, binWidthM - usedWidthM), facingWidthM)
}

export function facingCapacityMessage(
  binWidthM: number,
  facingWidthM: number,
  quantity: number,
  usedWidthM = 0,
): string | null {
  if (!(binWidthM > 0) || !(facingWidthM > 0) || quantity < 1) return null
  const remaining = remainingFacingsForShelf(binWidthM, facingWidthM, usedWidthM)
  if (quantity <= remaining) return null
  const needCm = (facingWidthM * quantity * 100).toFixed(0)
  const binCm = (binWidthM * 100).toFixed(0)
  const facingCm = (facingWidthM * 100).toFixed(0)
  const usedNote =
    usedWidthM > 0.0005
      ? ` (${(usedWidthM * 100).toFixed(0)} cm already occupied)`
      : ''
  return `${quantity} facing${quantity === 1 ? '' : 's'} need ${needCm} cm of shelf width (${facingCm} cm each) but only ${(Math.max(0, binWidthM - usedWidthM) * 100).toFixed(0)} cm of the ${binCm} cm shelf is free${usedNote} — max ${remaining} facing${remaining === 1 ? '' : 's'} available.`
}

export async function fetchBinInventory(binId: string): Promise<{
  success: boolean
  data?: BinInventoryData | null
  message?: string
}> {
  try {
    const res = await fetch(`/api/bin-inventory/by-bin/${encodeURIComponent(binId)}`, {
      headers: authHeaders(),
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: extractApiErrorMessage(json, 'Failed to load bin inventory') }
    }
    return { success: true, data: normalizeInventory(json?.data) }
  } catch {
    return { success: false, message: 'Network error while loading bin inventory' }
  }
}

export async function detachBinInventory(binId: string): Promise<{
  success: boolean
  message?: string
}> {
  try {
    const res = await fetch('/api/bin-inventory/detach', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ binId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: extractApiErrorMessage(json, 'Failed to detach bin inventory') }
    }
    return { success: true, message: json?.message || 'Inventory detached' }
  } catch {
    return { success: false, message: 'Network error while detaching inventory' }
  }
}
