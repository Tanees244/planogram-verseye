import type { Rack } from '@/store/planogramStore'

const generateId = () => Math.random().toString(36).substring(2, 9)

/** Unwraps ids that may arrive as a plain string or `{ rowId }` / `{ id }` object. */
export function resolveEntityId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    return (
      resolveEntityId(obj.rowId) ??
      resolveEntityId(obj.id) ??
      resolveEntityId(obj.rackRowId) ??
      resolveEntityId(obj.binId) ??
      resolveEntityId(obj.rackId) ??
      resolveEntityId(obj.sideId)
    )
  }
  return undefined
}

const DEFAULT_BIN_HEIGHT = 0.12

function computeBinDims(rackWidth: number, rackDepth: number, count: number) {
  const ext1 = rackWidth * 0.85
  const ext2 = rackDepth * 0.9
  const n = Math.max(1, count)
  if (rackWidth >= rackDepth) return { width: ext1 / n, depth: ext2 }
  return { width: ext1, depth: ext2 / n }
}

function asArray(value: any): any[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return (
    value.items ??
    value.results ??
    value.racks ??
    value.rows ??
    value.bins ??
    value.sides ??
    value.skus ??
    value.data ??
    []
  )
}

export function normalizeSkus(skus: any[]): any[] {
  return asArray(skus).map((p: any) => ({
    id: p.skuId ?? p.id ?? p.productId ?? generateId(),
    inventoryId: p.binInventoryId ?? p.inventoryId ?? p.id ?? undefined,
    name: p.skuName ?? p.name ?? p.productName ?? p.title ?? 'Product',
    color: p.color ?? `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    width: Number(p.width ?? 0.15),
    height: Number(p.height ?? 0.08),
    depth: Number(p.depth ?? 0.2),
    quantity: Number(p.quantity ?? 1),
    brandName: p.brandName ?? undefined,
    categoryName: p.categoryName ?? undefined,
    imageUrl: p.imageUrl ?? p.image ?? undefined,
    imageStorageKey: p.imageStorageKey ?? undefined,
  }))
}

const MAX_FACINGS = 24

/** Expands each SKU into N renderable facings based on its quantity (for 3D shelf display). */
export function expandProductsByQuantity<T extends { id: string; quantity?: number }>(
  products: T[],
): T[] {
  const expanded: T[] = []
  for (const product of products) {
    const n = Math.min(
      Math.max(1, Math.floor(Number(product.quantity) || 1)),
      MAX_FACINGS,
    )
    for (let i = 0; i < n; i++) {
      expanded.push({
        ...product,
        id: n > 1 ? `${product.id}::facing-${i}` : product.id,
        quantity: 1,
      } as T)
    }
  }
  return expanded
}

export function totalProductFacings(products: { quantity?: number }[]): number {
  return products.reduce(
    (sum, p) =>
      sum +
      Math.min(Math.max(1, Math.floor(Number(p.quantity) || 1)), MAX_FACINGS),
    0,
  )
}

/** Turns one rack from the by-store payload into the store's rack shape. */
export function normalizeRack(raw: any): Rack {
  const rackId = resolveEntityId(raw.rackId) ?? resolveEntityId(raw.id) ?? generateId()
  const rackCode = raw.rackCode ?? raw.rack_code ?? `RACK-${rackId}`
  const width = Number(raw.width ?? 2.5)
  const depth = Number(raw.depth ?? 2)
  const isDoubleSided = Boolean(raw.isDoubleSided ?? raw.is_double_sided)
  const sidesRaw = asArray(raw.sides)

  const sides = (sidesRaw.length > 0 ? sidesRaw : [{ sideId: generateId(), sideCode: 'S1', rows: [] }]).map(
    (s: any, idx: number) => {
      const rowsRaw = asArray(s.rows)
      const rows = rowsRaw.map((r: any) => {
        const rowHeight = Number(r.height ?? r.rowHeight ?? 1.5)
        const binsRaw = asArray(r.bins)
        const dims = computeBinDims(width, depth, binsRaw.length || 1)
        const bins = binsRaw.map((b: any) => ({
          id: resolveEntityId(b.binId) ?? resolveEntityId(b.id) ?? generateId(),
          width: dims.width,
          depth: dims.depth,
          height: rowHeight || DEFAULT_BIN_HEIGHT,
          binName: b.binName ?? b.name ?? b.binCode ?? undefined,
          products: normalizeSkus(b.skus ?? b.products ?? b.inventory),
        }))
        return {
          id: resolveEntityId(r.rowId) ?? resolveEntityId(r.id) ?? resolveEntityId(r.rackRowId) ?? generateId(),
          height: rowHeight,
          rowNumber: r.rowNumber ?? r.number ?? undefined,
          sided: isDoubleSided ? ('two' as const) : ('one' as const),
          bins,
        }
      })
      return {
        id: resolveEntityId(s.sideId) ?? resolveEntityId(s.id) ?? generateId(),
        sideId: resolveEntityId(s.sideId) ?? resolveEntityId(s.id) ?? generateId(),
        sideCode: s.sideCode ?? s.side_code ?? `S${idx + 1}`,
        rows,
      }
    },
  )

  return {
    id: rackId,
    rackId,
    rackCode,
    width,
    depth,
    height: raw.height != null ? String(raw.height) : undefined,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    isDoubleSided,
    sides,
  }
}

export function gridPlaceRacks(racks: Rack[], areaWidth: number, areaDepth: number): Rack[] {
  const n = racks.length
  if (n === 0) return []

  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const halfW = areaWidth / 2
  const halfD = areaDepth / 2
  const spacingX = areaWidth / (cols + 1)
  const spacingZ = areaDepth / (rows + 1)

  return racks.map((r, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = -halfW + spacingX * (col + 1)
    const z = halfD - spacingZ * (row + 1)
    return { ...r, position: { x, y: 0, z } }
  })
}

/** Keep rack positions/rotations from the current scene when refreshing layout data. */
export function mergeRackPositions(existing: Rack[], fresh: Rack[]): Rack[] {
  const layout = new Map(
    existing.map((r) => [
      r.rackId || r.id,
      { position: r.position, rotation: r.rotation, quadrant: r.quadrant },
    ]),
  )

  return fresh.map((rack) => {
    const key = rack.rackId || rack.id
    const prev = layout.get(key)
    if (!prev) return rack
    return {
      ...rack,
      position: prev.position,
      rotation: prev.rotation ?? rack.rotation,
      quadrant: prev.quadrant,
    }
  })
}

export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  try {
    const { getPlanogramTokenFromCookie } = await import('@verseye/utils')
    const t = getPlanogramTokenFromCookie()
    if (t) headers['Authorization'] = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

export async function fetchStoreLayoutRacks(
  storeId: string,
): Promise<{ success: boolean; racks: Rack[]; message?: string }> {
  const headers = await authHeaders()
  const res = await fetch(
    `/api/racks/by-store/${encodeURIComponent(storeId)}?page=1&pageSize=200`,
    { headers },
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.isRequestSuccess === false) {
    return {
      success: false,
      racks: [],
      message: json?.message || `Failed to load layout (${res.status})`,
    }
  }

  const data = json?.data ?? json
  const racksRaw = asArray(data?.racks ?? data)
  return { success: true, racks: racksRaw.map(normalizeRack) }
}
