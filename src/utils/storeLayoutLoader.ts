import type { Rack } from '@/store/planogramStore'
import type { FixtureType } from '@/components/fixtures/types'
import type { RackPlacement } from '@/types/rackBlueprint'
import type { Dimensions3, RackShell } from '@/types/rackBlueprint'
import {
  normalizeRackPosm,
  normalizeZoneFootprint,
  normalizeZoneVolume,
} from '@/utils/rackZones'
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
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes'
import { ensureRowAnchors } from '@/utils/rowStack'

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

function normalizeProductPosition(value: unknown): { x: number | null; y: number | null } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const axis = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return { x: axis(raw.x), y: axis(raw.y) }
}

export function normalizeSkus(skus: any[]): any[] {
  return asArray(skus).map((p: any) => {
    const attachments = asArray(p.attachments)
    const imageFromAttachments = attachments.find(
      (a: any) => a && a.is3D !== true && (a.storageKey || a.objectKey || a.url),
    )
    const modelFromAttachments = attachments.find(
      (a: any) =>
        a &&
        (a.is3D === true ||
          String(a.storageKey ?? a.objectKey ?? '').toLowerCase().endsWith('.glb') ||
          String(a.url ?? '').toLowerCase().includes('.glb')),
    )

    const id = String(p.skuId ?? p.id ?? p.productId ?? generateId())
    // Stable fallback color from id (avoids random rainbow boxes on every reload)
    const color =
      typeof p.color === 'string' && p.color
        ? p.color
        : `#${(Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 0xffffff)
            .toString(16)
            .padStart(6, '0')}`

    return {
      id,
      inventoryId: p.binInventoryId ?? p.inventoryId ?? p.id ?? undefined,
      name: p.skuName ?? p.name ?? p.productName ?? p.title ?? 'Product',
      color,
      width: safeDim(p.width, DEFAULT_PRODUCT_WIDTH),
      height: safeDim(p.height, DEFAULT_PRODUCT_HEIGHT),
      depth: safeDim(p.depth, DEFAULT_PRODUCT_DEPTH),
      quantity: Math.max(1, Math.floor(Number(p.quantity) || 1)),
      brandName: p.brandName ?? undefined,
      categoryName: p.categoryName ?? undefined,
      imageUrl: p.imageUrl ?? p.image ?? imageFromAttachments?.url ?? undefined,
      imageStorageKey:
        p.imageStorageKey ??
        imageFromAttachments?.storageKey ??
        imageFromAttachments?.objectKey ??
        undefined,
      modelUrl: p.modelUrl ?? p.glbUrl ?? p.model3dUrl ?? modelFromAttachments?.url ?? undefined,
      modelStorageKey:
        p.modelStorageKey ??
        p.glbStorageKey ??
        modelFromAttachments?.storageKey ??
        modelFromAttachments?.objectKey ??
        undefined,
      position: normalizeProductPosition(p.position),
    }
  })
}

function normalizeBinProducts(raw: any) {
  const productsRaw = raw.products ?? raw.skus ?? raw.inventory
  if (productsRaw) {
    const list = asArray(productsRaw)
    // Layout often returns thin `products[]` plus a richer `sku` with attachments
    if (raw.sku && list.length > 0) {
      const sku = raw.sku
      const skuId = String(sku.skuId ?? sku.id ?? '')
      return normalizeSkus(
        list.map((p: any) => {
          const pid = String(p.skuId ?? p.id ?? '')
          if (skuId && pid && skuId !== pid) return p
          return {
            ...p,
            imageUrl: p.imageUrl ?? sku.imageUrl ?? null,
            imageStorageKey: p.imageStorageKey ?? sku.imageStorageKey ?? null,
            modelUrl: p.modelUrl ?? sku.modelUrl ?? sku.glbUrl ?? null,
            modelStorageKey: p.modelStorageKey ?? sku.modelStorageKey ?? null,
            attachments:
              Array.isArray(p.attachments) && p.attachments.length > 0
                ? p.attachments
                : sku.attachments ?? [],
            brandName: p.brandName ?? sku.brandName,
            categoryName: p.categoryName ?? sku.categoryName,
            quantity: p.quantity ?? sku.quantity,
          }
        }),
      )
    }
    return normalizeSkus(list)
  }
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

function enrichShell(raw: any): RackShell | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  return {
    ...(raw as RackShell),
    headerPosm: normalizeRackPosm(raw.headerPosm ?? raw.headerDisplay),
    footerPosm: normalizeRackPosm(raw.footerPosm ?? raw.footerDisplay),
    leftWallPosm: normalizeRackPosm(raw.leftWallPosm ?? raw.leftWallDisplay),
    rightWallPosm: normalizeRackPosm(raw.rightWallPosm ?? raw.rightWallDisplay),
    headerPosmItemId: raw.headerPosmItemId ?? raw.headerDisplayProgramId ?? null,
    footerPosmItemId: raw.footerPosmItemId ?? raw.footerDisplayProgramId ?? null,
    leftWallPosmItemId: raw.leftWallPosmItemId ?? raw.leftWallDisplayProgramId ?? null,
    rightWallPosmItemId: raw.rightWallPosmItemId ?? raw.rightWallDisplayProgramId ?? null,
  }
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

// Renderable facings per SKU. Matches FACING_PACK_VISUAL_LIMIT so a bin
// filled to capacity actually shows every unit instead of a truncated
// front slice that looks empty/floating.
const MAX_FACINGS = 1500

/** Expands each SKU into N renderable facings based on its quantity (for 3D shelf display). */
export function expandProductsByQuantity<
  T extends {
    id: string
    quantity?: number
    position?: { x: number | null; y: number | null } | null
  },
>(
  products: T[],
): T[] {
  const expanded: T[] = []
  let facingCounter = 0
  for (const product of products) {
    const baseId = String(product.id).replace(/::facing-\d+$/, '')
    const n = Math.min(
      Math.max(1, Math.floor(Number(product.quantity) || 1)),
      MAX_FACINGS,
    )
    for (let i = 0; i < n; i++) {
      expanded.push({
        ...product,
        id: `${baseId}::facing-${facingCounter++}`,
        quantity: 1,
        // A stored coordinate anchors the SKU's first facing. Additional
        // quantity facings continue through the normal packing fallback.
        position: i === 0 ? product.position : null,
      } as T)
    }
  }
  return expanded
}

/** Strip `::facing-N` suffix added by {@link expandProductsByQuantity} for selection/API ids. */
export function resolveProductFacingId(id: string): string {
  return id.replace(/::facing-\d+$/, '')
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
  const shell = enrichShell(raw.shell)
  const outer = raw.outer as Dimensions3 | null | undefined
  const inner = raw.inner as Dimensions3 | null | undefined
  const customConfigBase =
    fixtureType === 'CUSTOM' ? shellToCustomConfig(shell, outer, 'CUSTOM') : undefined
  const sidesRaw = asArray(raw.sides ?? raw.layout?.sides)
  const customConfig = customConfigBase
    ? {
        ...customConfigBase,
        isDoubleSided: isDoubleSided || sidesRaw.length >= 2,
      }
    : undefined

  const sides = (sidesRaw.length > 0 ? sidesRaw : [{ sideId: generateId(), sideCode: 'S1', rows: [] }]).map(
    (s: any, idx: number) => {
      const rowsRaw = asArray(s.rows)
      const rows = rowsRaw.map((r: any) => {
        const rowHeight = safeDim(r.height ?? r.rowHeight, 1.5)
        const rowWidth = r.span ?? r.width
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
          ...(r.depth != null && Number(r.depth) > 0 ? { depth: Number(r.depth) } : {}),
          ...(rowWidth != null
            ? {
                width: safeDim(rowWidth, width * 0.85),
                span: safeDim(rowWidth, width * 0.85),
              }
            : {}),
          dividerThickness:
            r.dividerThickness != null ? safeDim(r.dividerThickness, 0.025) : 0.025,
          dividerPosmItemId: r.dividerPosmItemId ?? r.dividerDisplayProgramId ?? null,
          dividerPosm: normalizeRackPosm(r.dividerPosm ?? r.dividerDisplay),
          sided: (r.sided === 'two' ? 'two' : isDoubleSided ? 'two' : 'one') as 'one' | 'two',
          yStart: r.yStart != null ? Number(r.yStart) : null,
          yEnd: r.yEnd != null ? Number(r.yEnd) : null,
          bins,
        }
      })
      // Collapse duplicate/zero yStart anchors so shelves stack correctly in 3D
      const anchoredRows = ensureRowAnchors(rows)
      return {
        id: resolveEntityId(s.sideId) ?? resolveEntityId(s.id) ?? generateId(),
        sideId: resolveEntityId(s.sideId) ?? resolveEntityId(s.id) ?? generateId(),
        sideCode: s.sideCode ?? s.side_code ?? `S${idx + 1}`,
        depth: s.depth != null ? Number(s.depth) : null,
        inner: normalizeZoneFootprint(s.inner),
        outer: normalizeZoneFootprint(s.outer),
        header: normalizeZoneVolume(s.header),
        footer: normalizeZoneVolume(s.footer),
        dimensions:
          s.dimensions && typeof s.dimensions === 'object'
            ? {
                usableWidth:
                  s.dimensions.usableWidth != null ? Number(s.dimensions.usableWidth) : null,
                usableDepth:
                  s.dimensions.usableDepth != null ? Number(s.dimensions.usableDepth) : null,
                usableHeight:
                  s.dimensions.usableHeight != null ? Number(s.dimensions.usableHeight) : null,
              }
            : null,
        rows: anchoredRows,
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
    publishedAt: raw.publishedAt ?? raw.published_at ?? null,
    lastUpdated: raw.lastUpdated ?? raw.last_updated ?? raw.updatedAt ?? raw.updated_at ?? null,
    placement: placement ?? undefined,
    outer: outer ?? undefined,
    shell: shell ?? undefined,
    inner:
      inner ??
      (customConfig
        ? (() => {
            const d = computeCustomRackDimensions(customConfig)
            return { width: d.innerWidth, depth: d.innerDepth, height: d.innerHeight }
          })()
        : undefined),
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
export function mergeRackPositions(
  existing: Rack[],
  fresh: Rack[],
  options?: {
    /**
     * Keep the existing (local) placement even when the API returns one.
     * Use when refreshing an already-placed scene: the live session is the
     * source of truth for positions, and server placement can be stale
     * (e.g. after reflow / structure saves), which made racks jump.
     */
    preferExistingPlacement?: boolean
  },
): Rack[] {
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

    const useApiPlacement =
      Boolean(rack.placement?.position) && !options?.preferExistingPlacement

    return {
      ...rack,
      position: useApiPlacement ? rack.position : prev.position,
      rotation: useApiPlacement ? (rack.rotation ?? prev.rotation) : (prev.rotation ?? rack.rotation),
      quadrant: useApiPlacement ? (rack.quadrant ?? prev.quadrant) : (prev.quadrant ?? rack.quadrant),
      fixtureType: rack.fixtureType ?? prev.fixtureType,
      customConfig: rack.customConfig ?? prev.customConfig,
      blueprintName: rack.blueprintName ?? prev.blueprintName,
      placement: options?.preferExistingPlacement
        ? (prev.placement ?? rack.placement)
        : (rack.placement ?? prev.placement),
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

  try {
    const withMedia = await hydrateSkuMediaFromCatalog(hydrated)
    return { success: true, racks: withMedia }
  } catch {
    return { success: true, racks: hydrated }
  }
}

// ---------------------------------------------------------------------------
// SKU media hydration — layout endpoints often return thin product entries
// without attachments / model keys, so 3D models never render. Fill the gaps
// from the catalog SKU endpoint (cached per session).
// ---------------------------------------------------------------------------

interface SkuMedia {
  imageUrl?: string
  imageStorageKey?: string
  modelUrl?: string
  modelStorageKey?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const skuMediaCache = new Map<string, SkuMedia | null>()

function extractSkuMedia(s: any): SkuMedia {
  const attachments = asArray(s?.attachments)
  const imageAttachment = attachments.find(
    (a: any) => a && a.is3D !== true && (a.storageKey || a.objectKey || a.url),
  )
  const modelAttachment = attachments.find(
    (a: any) =>
      a &&
      (a.is3D === true ||
        String(a.storageKey ?? a.objectKey ?? '').toLowerCase().endsWith('.glb') ||
        String(a.url ?? '').toLowerCase().includes('.glb')),
  )
  return {
    imageUrl: s?.imageUrl ?? s?.image ?? imageAttachment?.url ?? undefined,
    imageStorageKey:
      s?.imageStorageKey ?? imageAttachment?.storageKey ?? imageAttachment?.objectKey ?? undefined,
    modelUrl: s?.modelUrl ?? s?.glbUrl ?? s?.model3dUrl ?? modelAttachment?.url ?? undefined,
    modelStorageKey:
      s?.modelStorageKey ??
      s?.glbStorageKey ??
      modelAttachment?.storageKey ??
      modelAttachment?.objectKey ??
      undefined,
  }
}

function productNeedsMedia(p: any): boolean {
  return !(p?.modelUrl || p?.modelStorageKey) || !(p?.imageUrl || p?.imageStorageKey)
}

async function fetchSkuMedia(skuId: string, headers: Record<string, string>): Promise<SkuMedia | null> {
  if (skuMediaCache.has(skuId)) return skuMediaCache.get(skuId) ?? null
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(skuId)}`, { headers })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) {
      skuMediaCache.set(skuId, null)
      return null
    }
    const media = extractSkuMedia(json?.data ?? json)
    skuMediaCache.set(skuId, media)
    return media
  } catch {
    skuMediaCache.set(skuId, null)
    return null
  }
}

/** Fill missing image / 3D model fields on bin products from the SKU catalog. */
export async function hydrateSkuMediaFromCatalog(racks: Rack[]): Promise<Rack[]> {
  const wanted = new Set<string>()
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        for (const bin of row.bins) {
          for (const p of bin.products) {
            const skuId = String(p.id).replace(/::facing-\d+$/, '')
            if (UUID_RE.test(skuId) && productNeedsMedia(p)) wanted.add(skuId)
          }
        }
      }
    }
  }
  if (wanted.size === 0) return racks

  const headers = { Accept: 'application/json', ...(await authHeaders()) }
  await Promise.all([...wanted].map((skuId) => fetchSkuMedia(skuId, headers)))

  return racks.map((rack) => ({
    ...rack,
    sides: rack.sides.map((side) => ({
      ...side,
      rows: side.rows.map((row) => ({
        ...row,
        bins: row.bins.map((bin) => ({
          ...bin,
          products: bin.products.map((p) => {
            const skuId = String(p.id).replace(/::facing-\d+$/, '')
            const media = skuMediaCache.get(skuId)
            if (!media) return p
            return {
              ...p,
              imageUrl: p.imageUrl ?? media.imageUrl,
              imageStorageKey: (p as any).imageStorageKey ?? media.imageStorageKey,
              modelUrl: p.modelUrl ?? media.modelUrl,
              modelStorageKey: p.modelStorageKey ?? media.modelStorageKey,
            }
          }),
        })),
      })),
    })),
  }))
}
