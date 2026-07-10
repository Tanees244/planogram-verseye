import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { extractApiErrorMessage } from '@/utils/apiMessages'

export interface BinInventorySku {
  skuId: string
  skuName: string
  quantity: number
  maxQuantity: number
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
      sku = {
        skuId,
        skuName: typeof s.skuName === 'string' ? s.skuName : typeof s.name === 'string' ? s.name : 'SKU',
        quantity: Math.max(0, Math.floor(Number(s.quantity) || 0)),
        maxQuantity: Math.max(0, Math.floor(Number(s.maxQuantity) || 0)),
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

export function remainingBinFacings(inventory: BinInventoryData | null): number | null {
  if (!inventory?.sku) return null
  return Math.max(0, inventory.sku.maxQuantity - inventory.sku.quantity)
}

/** Max facings that fit along bin shelf width (meters). */
export function maxFacingsForShelf(binWidthM: number, facingWidthM: number): number {
  if (!(binWidthM > 0) || !(facingWidthM > 0)) return 0
  return Math.max(0, Math.floor(binWidthM / facingWidthM + 1e-9))
}

export function facingCapacityMessage(
  binWidthM: number,
  facingWidthM: number,
  quantity: number,
  usedFacingCount = 0,
): string | null {
  if (!(binWidthM > 0) || !(facingWidthM > 0) || quantity < 1) return null
  const maxTotal = maxFacingsForShelf(binWidthM, facingWidthM)
  const remaining = Math.max(0, maxTotal - usedFacingCount)
  if (quantity <= remaining) return null
  const needCm = (facingWidthM * quantity * 100).toFixed(0)
  const binCm = (binWidthM * 100).toFixed(0)
  const facingCm = (facingWidthM * 100).toFixed(0)
  return `${quantity} facings need ${needCm} cm of shelf width (${facingCm} cm each) but the bin is only ${binCm} cm wide — max ${remaining} facing${remaining === 1 ? '' : 's'} available.`
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
