/**
 * Export helpers backed by GET /api/racks/{rackId}/structure
 * (canonical shelf / planogram tree + ideal image URLs).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type StructurePayload = Record<string, unknown>

export type StructureExportRow = {
  rackId: string
  rackCode: string
  rackName: string
  fixtureType: string
  rackWidthM: number | ''
  rackDepthM: number | ''
  rackHeightM: number | ''
  innerWidthM: number | ''
  innerDepthM: number | ''
  innerHeightM: number | ''
  sideCode: string
  shelfId: string
  shelfName: string
  shelfType: string
  planogramName: string
  idealImageUrl: string
  rowNumber: number | ''
  rowWidthM: number | ''
  rowHeightM: number | ''
  rowDepthM: number | ''
  utilizationPct: number | ''
  occupiedWidthM: number | ''
  remainingWidthM: number | ''
  binId: string
  binName: string
  binWidthM: number | ''
  binDepthM: number | ''
  binHeightM: number | ''
  xStartM: number | ''
  xEndM: number | ''
  skuId: string
  skuName: string
  skuCode: string
  barcode: string
  quantity: number | ''
  faceFacings: number | ''
  unitsDeep: number | ''
  verticalLayers: number | ''
  skuWidthM: number | ''
  skuDepthM: number | ''
  skuHeightM: number | ''
  posmName: string
}

export type StructureIdealRef = {
  shelfId: string
  name: string
  url: string | null
}

function num(v: unknown): number | '' {
  const n = Number(v)
  return Number.isFinite(n) ? n : ''
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const { getPlanogramTokenFromCookie } = await import('@verseye/utils')
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

export function serverRackIdOf(rack: { rackId?: string | null; id?: string | null }): string | null {
  const id = rack.rackId || rack.id
  return id && UUID_RE.test(id) ? id : null
}

/** GET /api/racks/{id}/structure — same payload as the View Planogram modal. */
export async function fetchRackStructurePayload(
  rackId: string,
): Promise<{ success: boolean; data?: StructurePayload; message?: string }> {
  if (!rackId || !UUID_RE.test(rackId)) {
    return { success: false, message: 'Invalid rack id' }
  }
  try {
    const headers = await authHeaders()
    const res = await fetch(`/api/racks/${encodeURIComponent(rackId)}/structure`, {
      headers,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false || json?.success === false) {
      const fallback = await fetch(`/api/racks/${encodeURIComponent(rackId)}`, {
        headers,
        cache: 'no-store',
      })
      const fbJson = await fallback.json().catch(() => ({}))
      if (!fallback.ok || fbJson?.isRequestSuccess === false || fbJson?.success === false) {
        return {
          success: false,
          message:
            json?.message ||
            fbJson?.message ||
            `Failed to load rack structure (${res.status})`,
        }
      }
      const data = (fbJson?.data ?? fbJson) as StructurePayload
      return { success: true, data }
    }
    const data = (json?.data ?? json) as StructurePayload
    return { success: true, data }
  } catch {
    return { success: false, message: 'Network error loading rack structure' }
  }
}

export function collectIdealImageRefs(data: StructurePayload): StructureIdealRef[] {
  const sides = Array.isArray(data.sides) ? data.sides : []
  const refs: StructureIdealRef[] = []
  for (const side of sides) {
    if (!side || typeof side !== 'object') continue
    const s = side as Record<string, unknown>
    const shelf =
      s.shelf && typeof s.shelf === 'object' ? (s.shelf as Record<string, unknown>) : null
    const shelfId = str(s.shelfId || shelf?.id || shelf?.shelfId)
    const urlRaw = shelf?.idealImageUrl ?? shelf?.ideal_image_url
    const url = typeof urlRaw === 'string' && urlRaw.trim() ? urlRaw.trim() : null
    if (!shelfId && !url) continue
    refs.push({
      shelfId,
      name: str(shelf?.planogramName || shelf?.name || data.rackName || data.rackCode || 'planogram'),
      url,
    })
  }
  return refs
}

export function flattenStructureDetails(data: StructurePayload): StructureExportRow[] {
  const outer =
    data.outer && typeof data.outer === 'object' ? (data.outer as Record<string, unknown>) : {}
  const inner =
    data.inner && typeof data.inner === 'object' ? (data.inner as Record<string, unknown>) : {}
  const sides = Array.isArray(data.sides) ? data.sides : []
  const rows: StructureExportRow[] = []
  const base = {
    rackId: str(data.rackId || data.id),
    rackCode: str(data.rackCode),
    rackName: str(data.rackName || data.blueprintName),
    fixtureType: str(data.fixtureType),
    rackWidthM: num(outer.width ?? data.width),
    rackDepthM: num(outer.depth ?? data.depth),
    rackHeightM: num(outer.height ?? data.height),
    innerWidthM: num(inner.width),
    innerDepthM: num(inner.depth),
    innerHeightM: num(inner.height),
  }

  if (sides.length === 0) {
    rows.push({
      ...base,
      sideCode: '',
      shelfId: '',
      shelfName: '',
      shelfType: '',
      planogramName: '',
      idealImageUrl: '',
      rowNumber: '',
      rowWidthM: '',
      rowHeightM: '',
      rowDepthM: '',
      utilizationPct: '',
      occupiedWidthM: '',
      remainingWidthM: '',
      binId: '',
      binName: '',
      binWidthM: '',
      binDepthM: '',
      binHeightM: '',
      xStartM: '',
      xEndM: '',
      skuId: '',
      skuName: '',
      skuCode: '',
      barcode: '',
      quantity: '',
      faceFacings: '',
      unitsDeep: '',
      verticalLayers: '',
      skuWidthM: '',
      skuDepthM: '',
      skuHeightM: '',
      posmName: '',
    })
    return rows
  }

  for (const side of sides) {
    if (!side || typeof side !== 'object') continue
    const s = side as Record<string, unknown>
    const shelf =
      s.shelf && typeof s.shelf === 'object' ? (s.shelf as Record<string, unknown>) : {}
    const sideMeta = {
      sideCode: str(s.sideCode),
      shelfId: str(s.shelfId || shelf.id),
      shelfName: str(shelf.name),
      shelfType: str(shelf.shelfType),
      planogramName: str(shelf.planogramName),
      idealImageUrl: str(shelf.idealImageUrl),
    }
    const rowList = Array.isArray(s.rows) ? s.rows : []
    if (rowList.length === 0) {
      rows.push({
        ...base,
        ...sideMeta,
        rowNumber: '',
        rowWidthM: '',
        rowHeightM: '',
        rowDepthM: '',
        utilizationPct: '',
        occupiedWidthM: '',
        remainingWidthM: '',
        binId: '',
        binName: '',
        binWidthM: '',
        binDepthM: '',
        binHeightM: '',
        xStartM: '',
        xEndM: '',
        skuId: '',
        skuName: '',
        skuCode: '',
        barcode: '',
        quantity: '',
        faceFacings: '',
        unitsDeep: '',
        verticalLayers: '',
        skuWidthM: '',
        skuDepthM: '',
        skuHeightM: '',
        posmName: '',
      })
      continue
    }

    for (const row of rowList) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const util =
        r.utilization && typeof r.utilization === 'object'
          ? (r.utilization as Record<string, unknown>)
          : {}
      const divider =
        r.dividerPosm && typeof r.dividerPosm === 'object'
          ? (r.dividerPosm as Record<string, unknown>)
          : null
      const rowMeta = {
        rowNumber: num(r.rowNumber),
        rowWidthM: num(r.width ?? r.span),
        rowHeightM: num(r.height),
        rowDepthM: num(r.depth),
        utilizationPct: num(util.utilizationPercent),
        occupiedWidthM: num(util.occupiedWidthMeters),
        remainingWidthM: num(util.remainingWidthMeters),
      }
      const bins = Array.isArray(r.bins) ? r.bins : []
      if (bins.length === 0) {
        rows.push({
          ...base,
          ...sideMeta,
          ...rowMeta,
          binId: '',
          binName: '',
          binWidthM: '',
          binDepthM: '',
          binHeightM: '',
          xStartM: '',
          xEndM: '',
          skuId: '',
          skuName: '',
          skuCode: '',
          barcode: '',
          quantity: '',
          faceFacings: '',
          unitsDeep: '',
          verticalLayers: '',
          skuWidthM: '',
          skuDepthM: '',
          skuHeightM: '',
          posmName: str(divider?.name),
        })
        continue
      }

      for (const bin of bins) {
        if (!bin || typeof bin !== 'object') continue
        const b = bin as Record<string, unknown>
        const sku = b.sku && typeof b.sku === 'object' ? (b.sku as Record<string, unknown>) : null
        const products = Array.isArray(b.products) ? b.products : []
        const itemTag =
          b.itemTagPosm && typeof b.itemTagPosm === 'object'
            ? (b.itemTagPosm as Record<string, unknown>)
            : null
        const posmName = str(itemTag?.name || divider?.name)
        const binMeta = {
          binId: str(b.binId || b.id),
          binName: str(b.binName),
          binWidthM: num(b.width),
          binDepthM: num(b.depth),
          binHeightM: num(b.height),
          xStartM: num(b.xStart),
          xEndM: num(b.xEnd),
          posmName,
        }

        const sources = products.length > 0 ? products : sku ? [sku] : [null]
        for (const item of sources) {
          const p = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
          rows.push({
            ...base,
            ...sideMeta,
            ...rowMeta,
            ...binMeta,
            skuId: str(p?.id || p?.skuId || sku?.skuId),
            skuName: str(p?.name || p?.skuName || sku?.skuName || sku?.skuName),
            skuCode: str(sku?.skuCode || p?.skuCode),
            barcode: str(sku?.barcode || p?.barcode),
            quantity: num(p?.quantity ?? p?.totalQuantity ?? sku?.quantity),
            faceFacings: num(p?.faceFacings ?? sku?.quantity),
            unitsDeep: num(p?.unitsDeep),
            verticalLayers: num(p?.verticalLayers),
            skuWidthM: num(p?.width),
            skuDepthM: num(p?.depth),
            skuHeightM: num(p?.height),
          })
        }
      }
    }
  }

  return rows
}

export type StructureOutlineItem = {
  kind: 'rack' | 'side' | 'row' | 'bin' | 'sku'
  indent: number
  title: string
  detail: string
}

function meters(v: unknown): string {
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toFixed(2)} m` : ''
}

function packLabel(face: unknown, deep: unknown, layers: unknown, qty: unknown): string {
  const parts: string[] = []
  const q = Number(qty)
  if (Number.isFinite(q)) parts.push(`${q} unit${q === 1 ? '' : 's'}`)
  const f = Number(face)
  const d = Number(deep)
  const l = Number(layers)
  const pack: string[] = []
  if (Number.isFinite(f) && f > 0) pack.push(`${f} face`)
  if (Number.isFinite(d) && d > 0) pack.push(`${d} deep`)
  if (Number.isFinite(l) && l > 0) pack.push(`${l} stack`)
  if (pack.length) parts.push(pack.join(' × '))
  return parts.join(' · ')
}

/**
 * Hierarchical outline: Rack → Side → Row → Bin → SKU
 * Matches GET /racks/{id}/structure.
 */
export function buildStructureOutline(data: StructurePayload): StructureOutlineItem[] {
  const items: StructureOutlineItem[] = []
  const outer =
    data.outer && typeof data.outer === 'object' ? (data.outer as Record<string, unknown>) : {}
  const inner =
    data.inner && typeof data.inner === 'object' ? (data.inner as Record<string, unknown>) : {}
  const name = str(data.rackName || data.rackCode || 'Rack')
  const code = str(data.rackCode)
  const fixture = str(data.fixtureType)
  const rackTitle = [name, code && code !== name ? code : '', fixture].filter(Boolean).join('  ·  ')
  const rackDetail = [
    `Outer ${meters(outer.width ?? data.width)} × ${meters(outer.depth ?? data.depth)} × ${meters(outer.height ?? data.height)}`,
    `Inner ${meters(inner.width)} × ${meters(inner.depth)} × ${meters(inner.height)}`,
  ]
    .filter((s) => !s.includes(' ×  × ') && !s.endsWith('Inner  ×  × '))
    .join('   ')

  items.push({ kind: 'rack', indent: 0, title: rackTitle, detail: rackDetail })

  const sides = Array.isArray(data.sides) ? data.sides : []
  if (sides.length === 0) {
    items.push({ kind: 'side', indent: 1, title: 'No sides on this rack', detail: '' })
    return items
  }

  for (const side of sides) {
    if (!side || typeof side !== 'object') continue
    const s = side as Record<string, unknown>
    const shelf =
      s.shelf && typeof s.shelf === 'object' ? (s.shelf as Record<string, unknown>) : {}
    const dims =
      s.dimensions && typeof s.dimensions === 'object'
        ? (s.dimensions as Record<string, unknown>)
        : {}
    const sideCode = str(s.sideCode) || 'S1'
    const shelfName = str(shelf.planogramName || shelf.name)
    items.push({
      kind: 'side',
      indent: 1,
      title: shelfName ? `${sideCode}  ·  ${shelfName}` : sideCode,
      detail: [
        str(shelf.shelfType),
        dims.usableWidth || dims.usableDepth
          ? `usable ${meters(dims.usableWidth)} × ${meters(dims.usableDepth)} × ${meters(dims.usableHeight)}`
          : '',
      ]
        .filter(Boolean)
        .join('  ·  '),
    })

    const rowList = Array.isArray(s.rows) ? s.rows : []
    if (rowList.length === 0) {
      items.push({ kind: 'row', indent: 2, title: 'No rows', detail: '' })
      continue
    }

    for (const row of rowList) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const util =
        r.utilization && typeof r.utilization === 'object'
          ? (r.utilization as Record<string, unknown>)
          : {}
      const rowNo = num(r.rowNumber)
      const bins = Array.isArray(r.bins) ? r.bins : []
      const utilPct = num(util.utilizationPercent)
      const occupied = meters(util.occupiedWidthMeters)
      const available = meters(util.availableWidthMeters ?? r.width ?? r.span)
      const emptyRow = bins.length === 0
      items.push({
        kind: 'row',
        indent: 2,
        title: `Row ${rowNo === '' ? '?' : rowNo}${emptyRow ? '  ·  empty' : ''}`,
        detail: [
          `${meters(r.width ?? r.span)} W × ${meters(r.height)} H`,
          utilPct === ''
            ? ''
            : `${Number(utilPct).toFixed(1)}% used${occupied && available ? ` (${occupied} / ${available})` : ''}`,
        ]
          .filter(Boolean)
          .join('  ·  '),
      })

      if (emptyRow) continue

      for (const bin of bins) {
        if (!bin || typeof bin !== 'object') continue
        const b = bin as Record<string, unknown>
        const sku = b.sku && typeof b.sku === 'object' ? (b.sku as Record<string, unknown>) : null
        const products = Array.isArray(b.products) ? b.products : []
        const hasSku = products.length > 0 || Boolean(sku)
        const binName = str(b.binName) || (hasSku ? str(sku?.skuName) : 'Empty slot')
        items.push({
          kind: 'bin',
          indent: 3,
          title: binName,
          detail: [
            meters(b.width) ? `${meters(b.width)} wide` : '',
            hasSku ? '' : 'no SKU',
            str(b.xStart) !== '' && str(b.xEnd) !== ''
              ? `${meters(b.xStart)} → ${meters(b.xEnd)}`
              : '',
          ]
            .filter(Boolean)
            .join('  ·  '),
        })

        const sources = products.length > 0 ? products : sku ? [sku] : []
        for (const item of sources) {
          if (!item || typeof item !== 'object') continue
          const p = item as Record<string, unknown>
          const skuName = str(p.name || p.skuName || sku?.skuName)
          const skuCode = str(sku?.skuCode || p.skuCode)
          items.push({
            kind: 'sku',
            indent: 4,
            title: skuCode ? `${skuCode}  ·  ${skuName}` : skuName || 'SKU',
            detail: packLabel(
              p.faceFacings ?? sku?.quantity,
              p.unitsDeep,
              p.verticalLayers,
              p.quantity ?? p.totalQuantity ?? sku?.quantity,
            ),
          })
        }
      }
    }
  }

  return items
}

export type StructureDrawBin = {
  name: string
  skuName: string
  skuCode: string
  xStart: number
  width: number
  faceFacings: number
  quantity: number
  empty: boolean
  color?: string
}

export type StructureDrawRow = {
  rowNumber: number
  width: number
  height: number
  utilizationPct: number
  bins: StructureDrawBin[]
}

export type StructureDrawSide = {
  sideCode: string
  shelfName: string
  usableWidth: number
  rows: StructureDrawRow[]
}

/** Drawable 2D elevation model from GET /racks/{id}/structure. */
export function extractStructureDrawSides(data: StructurePayload): StructureDrawSide[] {
  const inner =
    data.inner && typeof data.inner === 'object' ? (data.inner as Record<string, unknown>) : {}
  const sides = Array.isArray(data.sides) ? data.sides : []
  const out: StructureDrawSide[] = []

  for (const side of sides) {
    if (!side || typeof side !== 'object') continue
    const s = side as Record<string, unknown>
    const shelf =
      s.shelf && typeof s.shelf === 'object' ? (s.shelf as Record<string, unknown>) : {}
    const dims =
      s.dimensions && typeof s.dimensions === 'object'
        ? (s.dimensions as Record<string, unknown>)
        : {}
    const usableWidth =
      Number(dims.usableWidth) > 0
        ? Number(dims.usableWidth)
        : Number(inner.width) > 0
          ? Number(inner.width)
          : 1
    const rowList = Array.isArray(s.rows) ? s.rows : []
    const rows: StructureDrawRow[] = []

    for (const row of rowList) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const util =
        r.utilization && typeof r.utilization === 'object'
          ? (r.utilization as Record<string, unknown>)
          : {}
      const rowWidth =
        Number(r.width) > 0 ? Number(r.width) : Number(r.span) > 0 ? Number(r.span) : usableWidth
      const binsRaw = Array.isArray(r.bins) ? r.bins : []
      const bins: StructureDrawBin[] = []
      for (const bin of binsRaw) {
        if (!bin || typeof bin !== 'object') continue
        const b = bin as Record<string, unknown>
        const sku = b.sku && typeof b.sku === 'object' ? (b.sku as Record<string, unknown>) : null
        const products = Array.isArray(b.products) ? b.products : []
        const first =
          products[0] && typeof products[0] === 'object'
            ? (products[0] as Record<string, unknown>)
            : sku
        const qty = Number(first?.quantity ?? first?.totalQuantity ?? sku?.quantity) || 0
        const faces = Number(first?.faceFacings ?? qty) || 0
        const empty = !first || qty <= 0
        const width = Number(b.width) > 0 ? Number(b.width) : 0
        const xStart = Number(b.xStart)
        bins.push({
          name: str(b.binName) || str(first?.name || sku?.skuName) || (empty ? 'Empty' : 'Slot'),
          skuName: str(first?.name || first?.skuName || sku?.skuName),
          skuCode: str(sku?.skuCode || first?.skuCode),
          xStart: Number.isFinite(xStart) ? xStart : 0,
          width,
          faceFacings: faces,
          quantity: qty,
          empty,
          color: typeof first?.color === 'string' ? first.color : undefined,
        })
      }
      rows.push({
        rowNumber: Number(r.rowNumber) || rows.length + 1,
        width: rowWidth,
        height: Number(r.height) || 0,
        utilizationPct: Number(util.utilizationPercent) || 0,
        bins,
      })
    }

    out.push({
      sideCode: str(s.sideCode) || `S${out.length + 1}`,
      shelfName: str(shelf.planogramName || shelf.name || data.rackName),
      usableWidth,
      rows,
    })
  }
  return out
}
