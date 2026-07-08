import type { Rack } from '@/store/planogramStore'
import type { FixtureType } from '@/components/fixtures/types'
import type { RackPlacement } from '@/types/rackBlueprint'
import type { Dimensions3, RackShell, ShelfTalker } from '@/types/rackBlueprint'
import { safeDim, safePosition } from '@/utils/safeDimensions'
import {
  DEFAULT_BIN_HEIGHT,
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
} from '@/constants/dimensions'
import {
  parsePlacement,
  parseQuadrant,
  placementToPosition,
  placementToRotation,
  resolveRackDimensions,
  shellToCustomConfig,
} from '@/utils/rackBlueprintMapper'

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
      resolveEntityId(obj.sideId) ??
      resolveEntityId(obj.shelfTalkerId)
    )
  }
  return undefined
}

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
    value.talkers ??
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
    width: safeDim(p.width, DEFAULT_PRODUCT_WIDTH),
    height: safeDim(p.height, DEFAULT_PRODUCT_HEIGHT),
    depth: safeDim(p.depth, DEFAULT_PRODUCT_DEPTH),
    quantity: Math.max(1, Math.floor(Number(p.quantity) || 1)),
    brandName: p.brandName ?? undefined,
    categoryName: p.categoryName ?? undefined,
    imageUrl: p.imageUrl ?? p.image ?? undefined,
    imageStorageKey: p.imageStorageKey ?? undefined,
  }))
}

function normalizeBinProducts(raw: any) {
  const productsRaw = raw.products ?? raw.skus ?? raw.inventory
  if (productsRaw) return normalizeSkus(asArray(productsRaw))
  if (raw.sku) return normalizeSkus([raw.sku])
  return []
}

function resolveBinDimensions(
  b: any,
  rowHeight: number,
  fallback: { width: number; depth: number },
): { width: number; depth: number; height: number } {
  return {
    width: safeDim(b.width, fallback.width),
    depth: safeDim(b.depth, fallback.depth),
    height: safeDim(b.height, safeDim(rowHeight, DEFAULT_BIN_HEIGHT)),
  }
}

function normalizeTalkers(raw: any): ShelfTalker[] {
  return asArray(raw).map((t: any) => ({
    id: resolveEntityId(t.id) ?? resolveEntityId(t.shelfTalkerId) ?? generateId(),
    rackRowId: resolveEntityId(t.rackRowId) ?? null,
    label: t.label ?? null,
    length: safeDim(t.length, 0.2),
    innerDepth: safeDim(t.innerDepth, 0.05),
    outerHeight: safeDim(t.outerHeight, 0.08),
    slotPosition: Math.max(1, Math.floor(Number(t.slotPosition) || 1)),
    placementZone: t.placementZone ?? 'inner',
  }))
}

/** Unwrap blueprint document (`data.rack` + `layout.sides`) into a flat structure shape. */
export function unwrapRackPayload(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  if (raw.rack && typeof raw.rack === 'object') {
    const rack = raw.rack
    return {
      ...rack,
      blueprintName: raw.name ?? rack.blueprintName,
      sides: rack.sides ?? rack.layout?.sides ?? [],
    }
  }
  return raw
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

/** Turns one rack from the by-store/structure/blueprint payload into the store's rack shape. */
export function normalizeRack(rawInput: any): Rack {
  const raw = unwrapRackPayload(rawInput)
  const rackId = resolveEntityId(raw.rackId) ?? resolveEntityId(raw.id) ?? generateId()
  const rackCode = raw.rackCode ?? raw.rack_code ?? `RACK-${rackId}`
  const dims = resolveRackDimensions(raw)
  const { width, depth, outerHeight } = dims
  const isDoubleSided = Boolean(raw.isDoubleSided ?? raw.is_double_sided)
  const fixtureType = (raw.fixtureType ?? raw.fixture_type ?? (isDoubleSided ? 'GONDOLA' : 'GONDOLA')) as FixtureType
  const placement = parsePlacement(raw)
  const rotation = placement ? placementToRotation(placement) : { x: 0, y: 0, z: 0 }
  const quadrant = parseQuadrant(placement?.quadrant ?? raw.quadrant)
  const shell = raw.shell as RackShell | null | undefined
  const outer = raw.outer as Dimensions3 | null | undefined
  const inner = raw.inner as Dimensions3 | null | undefined
  const customConfig =
    fixtureType === 'CUSTOM' ? shellToCustomConfig(shell, outer, 'CUSTOM') : undefined
  const sidesRaw = asArray(raw.sides ?? raw.layout?.sides)

  const sides = (sidesRaw.length > 0 ? sidesRaw : [{ sideId: generateId(), sideCode: 'S1', rows: [] }]).map(
    (s: any, idx: number) => {
      const rowsRaw = asArray(s.rows)
      const rows = rowsRaw.map((r: any) => {
        const rowHeight = safeDim(r.height ?? r.rowHeight, 1.5)
        const rowWidth = r.width ?? r.span
        const binsRaw = asArray(r.bins)
        const binFallback = computeBinDims(width, depth, binsRaw.length || 1)
        const bins = binsRaw.map((b: any) => {
          const binDims = resolveBinDimensions(b, rowHeight, binFallback)
          return {
            id: resolveEntityId(b.binId) ?? resolveEntityId(b.id) ?? generateId(),
            width: binDims.width,
            depth: binDims.depth,
            height: binDims.height,
            binName: b.binName ?? b.name ?? b.binCode ?? undefined,
            products: normalizeBinProducts(b),
          }
        })
        return {
          id: resolveEntityId(r.rowId) ?? resolveEntityId(r.id) ?? resolveEntityId(r.rackRowId) ?? generateId(),
          height: rowHeight,
          ...(rowWidth != null ? { width: safeDim(rowWidth, width * 0.85) } : {}),
          sided: (r.sided === 'two' ? 'two' : isDoubleSided ? 'two' : 'one') as 'one' | 'two',
          yStart: r.yStart != null ? Number(r.yStart) : null,
          yEnd: r.yEnd != null ? Number(r.yEnd) : null,
          talkers: normalizeTalkers(r.talkers),
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
    width: safeDim(width, 1),
    depth: safeDim(depth, 0.5),
    height: raw.height != null ? String(raw.height) : String(outerHeight),
    fixtureType,
    customConfig,
    blueprintName: raw.blueprintName ?? raw.blueprint_name ?? undefined,
    placement: placement ?? undefined,
    outer: outer ?? undefined,
    shell: shell ?? undefined,
    inner: inner ?? undefined,
    position: {
      x: safePosition(placement?.position?.x, 0),
      y: safePosition(placement?.position?.y, 0),
      z: safePosition(placement?.position?.z, 0),
    },
    rotation,
    isDoubleSided,
    quadrant,
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

/** Keep rack positions/rotations and 3D-only fields when refreshing layout data. */
export function mergeRackPositions(existing: Rack[], fresh: Rack[]): Rack[] {
  const byKey = new Map(
    existing.map((r) => [
      r.rackId || r.id,
      r,
    ]),
  )

  return fresh.map((rack) => {
    const key = rack.rackId || rack.id
    const prev = byKey.get(key)
    if (!prev) return rack

    const hasApiPlacement = Boolean(rack.placement?.position)

    return {
      ...rack,
      position: hasApiPlacement ? rack.position : prev.position,
      rotation: hasApiPlacement ? (rack.rotation ?? prev.rotation) : (prev.rotation ?? rack.rotation),
      quadrant: hasApiPlacement ? (rack.quadrant ?? prev.quadrant) : (prev.quadrant ?? rack.quadrant),
      fixtureType: rack.fixtureType ?? prev.fixtureType,
      customConfig: rack.customConfig ?? prev.customConfig,
      blueprintName: rack.blueprintName ?? prev.blueprintName,
      placement: rack.placement ?? prev.placement,
      outer: rack.outer ?? prev.outer,
      shell: rack.shell ?? prev.shell,
      inner: rack.inner ?? prev.inner,
      width: rack.width || prev.width,
      depth: rack.depth || prev.depth,
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

export async function fetchRackStructure(
  rackId: string,
): Promise<{ success: boolean; rack?: Rack; message?: string }> {
  const headers = await authHeaders()
  const res = await fetch(`/api/racks/${encodeURIComponent(rackId)}/structure`, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.isRequestSuccess === false) {
    return {
      success: false,
      message: json?.message || `Failed to load structure (${res.status})`,
    }
  }
  return { success: true, rack: normalizeRack(json?.data ?? json) }
}

export async function fetchRackBlueprint(
  rackId: string,
): Promise<{ success: boolean; rack?: Rack; blueprint?: unknown; message?: string }> {
  const headers = await authHeaders()
  const res = await fetch(`/api/racks/${encodeURIComponent(rackId)}/blueprint`, { headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.isRequestSuccess === false) {
    return {
      success: false,
      message: json?.message || `Failed to load blueprint (${res.status})`,
    }
  }
  const blueprint = json?.data ?? json
  return { success: true, blueprint, rack: normalizeRack(blueprint) }
}

/** Load store listing, then hydrate each rack with full structure (sides/rows/bins). */
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
  const summaries = racksRaw.map(normalizeRack)

  const hydrated = await Promise.all(
    summaries.map(async (summary) => {
      const id = summary.rackId || summary.id
      if (!id) return summary
      try {
        const structure = await fetchRackStructure(id)
        if (structure.success && structure.rack) {
          return mergeRackPositions([summary], [structure.rack])[0]
        }
        const blueprint = await fetchRackBlueprint(id)
        if (blueprint.success && blueprint.rack) {
          return mergeRackPositions([summary], [blueprint.rack])[0]
        }
      } catch {
        /* keep summary */
      }
      return summary
    }),
  )

  return { success: true, racks: hydrated }
}
