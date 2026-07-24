/**
 * Exact face-fill helpers (linear front facings).
 * Aligns with backend FRONTEND_EXACT_FACE_FILL.md — meters / positive integers.
 */

export const FACE_FILL_TOLERANCE_M = 0.001

export type FaceFillProduct = {
  width?: number | null
  quantity?: number | null
  isActive?: boolean | null
}

export type FaceFillBin = {
  id?: string
  width?: number | null
  isActive?: boolean | null
  products?: FaceFillProduct[] | null
}

export type FaceFillRow = {
  id?: string
  span?: number | null
  width?: number | null
  isActive?: boolean | null
  bins?: FaceFillBin[] | null
}

export type FaceFillIssue = {
  severity: 'error' | 'warning'
  code:
    | 'RowEmpty'
    | 'RowFaceUnderfilled'
    | 'RowSpanOverflow'
    | 'BinEmpty'
    | 'BinFaceUnderfilled'
    | 'BinFaceOverfilled'
    | 'ProductExceedsBin'
  message: string
  rowId?: string
  binId?: string
}

export function rowSpanMeters(
  row: { span?: number | null; width?: number | null },
  rack?: { inner?: { width?: number | null } | null; width?: number | null } | null,
): number | null {
  const fromRow = row.span ?? row.width
  if (fromRow != null && Number.isFinite(fromRow) && fromRow > 0) return Number(fromRow)
  const fromInner = rack?.inner?.width
  if (fromInner != null && Number.isFinite(fromInner) && fromInner > 0) return Number(fromInner)
  const fromRack = rack?.width
  if (fromRack != null && Number.isFinite(fromRack) && fromRack > 0) return Number(fromRack)
  return null
}

/** Σ(product.width × quantity) — linear front meters. */
export function binFacingOccupied(products: FaceFillProduct[] | null | undefined): number {
  if (!Array.isArray(products)) return 0
  return products.reduce((sum, p) => {
    if (p?.isActive === false) return sum
    const w = Number(p.width)
    const q = Math.max(0, Math.floor(Number(p.quantity) || 0))
    if (!(w > 0) || q < 1) return sum
    return sum + w * q
  }, 0)
}

export function minProductFacingWidth(products: FaceFillProduct[] | null | undefined): number {
  if (!Array.isArray(products)) return 0
  let min = Infinity
  for (const p of products) {
    if (p?.isActive === false) continue
    const w = Number(p.width)
    if (w > 0 && w < min) min = w
  }
  return Number.isFinite(min) ? min : 0
}

/** Front face is filled when exact (≤1 mm) or leftover gap is too small for another facing. */
export function isFaceFilled(
  occupied: number,
  available: number,
  minFacingWidth: number,
): boolean {
  if (!(available > 0)) return false
  if (Math.abs(occupied - available) <= FACE_FILL_TOLERANCE_M) return true
  if (occupied > available + FACE_FILL_TOLERANCE_M) return false
  if (!(minFacingWidth > 0)) return occupied > 0
  const gap = available - occupied
  return gap + FACE_FILL_TOLERANCE_M < minFacingWidth
}

/** Linear front facings that fit across bin width. */
export function suggestedFaceFacings(binWidthM: number, skuWidthM: number): number {
  if (!(binWidthM > 0) || !(skuWidthM > 0)) return 0
  return Math.max(0, Math.floor(binWidthM / skuWidthM + 1e-6))
}

/** Remaining front facings given width already occupied. */
export function remainingFaceFacings(
  binWidthM: number,
  skuWidthM: number,
  usedWidthM: number,
): number {
  if (!(binWidthM > 0) || !(skuWidthM > 0)) return 0
  const free = Math.max(0, binWidthM - Math.max(0, usedWidthM))
  return suggestedFaceFacings(free, skuWidthM)
}

export function remainingRowSpanM(
  row: FaceFillRow,
  rack: { inner?: { width?: number | null } | null; width?: number | null } | null | undefined,
  bins?: FaceFillBin[] | null,
): number {
  const span = rowSpanMeters(row, rack) ?? 0
  const list = bins ?? row.bins ?? []
  const used = list.reduce((s, b) => {
    if (b?.isActive === false) return s
    const w = Number(b.width)
    return s + (w > 0 ? w : 0)
  }, 0)
  return span - used
}

export type RowFaceFillState = 'complete' | 'row_gap' | 'bin_gap' | 'overfill' | 'empty'

export function rowFaceFillState(
  row: FaceFillRow,
  rack?: { inner?: { width?: number | null } | null; width?: number | null } | null,
): { state: RowFaceFillState; remainingSpanM: number; issues: FaceFillIssue[] } {
  const issues: FaceFillIssue[] = []
  const bins = (row.bins ?? []).filter((b) => b?.isActive !== false)
  const span = rowSpanMeters(row, rack)

  if (bins.length === 0) {
    issues.push({
      severity: 'error',
      code: 'RowEmpty',
      message: 'Row must contain bins that fill the front span',
      rowId: row.id,
    })
    return { state: 'empty', remainingSpanM: span ?? 0, issues }
  }

  if (span == null || !(span > 0)) {
    return { state: 'complete', remainingSpanM: 0, issues }
  }

  const used = bins.reduce((s, b) => s + (Number(b.width) > 0 ? Number(b.width) : 0), 0)
  const remainingSpanM = span - used

  if (used > span + FACE_FILL_TOLERANCE_M) {
    issues.push({
      severity: 'error',
      code: 'RowSpanOverflow',
      message: `Bin widths (${used.toFixed(3)}m) must equal available space (${span.toFixed(3)}m)`,
      rowId: row.id,
    })
    return { state: 'overfill', remainingSpanM, issues }
  }

  let anyBinGap = false
  let anyOverfill = false

  for (const bin of bins) {
    const binW = Number(bin.width)
    const products = (bin.products ?? []).filter((p) => p?.isActive !== false)
    if (products.length === 0) {
      issues.push({
        severity: 'error',
        code: 'BinEmpty',
        message: 'Bin must contain SKUs that fill the front face',
        rowId: row.id,
        binId: bin.id,
      })
      anyBinGap = true
      continue
    }
    if (!(binW > 0)) continue

    const occupied = binFacingOccupied(products)
    const minW = minProductFacingWidth(products)

    for (const p of products) {
      const pw = Number(p.width)
      if (pw > binW + FACE_FILL_TOLERANCE_M) {
        issues.push({
          severity: 'error',
          code: 'ProductExceedsBin',
          message: `Product facing width (${pw.toFixed(3)}m) exceeds bin width (${binW.toFixed(3)}m)`,
          rowId: row.id,
          binId: bin.id,
        })
        anyOverfill = true
      }
    }

    if (occupied > binW + FACE_FILL_TOLERANCE_M) {
      issues.push({
        severity: 'error',
        code: 'BinFaceOverfilled',
        message: `Product facing width (${occupied.toFixed(3)}m) exceeds bin width (${binW.toFixed(3)}m)`,
        rowId: row.id,
        binId: bin.id,
      })
      anyOverfill = true
    } else if (!isFaceFilled(occupied, binW, minW)) {
      issues.push({
        severity: 'error',
        code: 'BinFaceUnderfilled',
        message: `Product facing width (${occupied.toFixed(3)}m) leaves empty front space on bin (${binW.toFixed(3)}m)`,
        rowId: row.id,
        binId: bin.id,
      })
      anyBinGap = true
    }
  }

  if (remainingSpanM > FACE_FILL_TOLERANCE_M) {
    issues.push({
      severity: 'error',
      code: 'RowFaceUnderfilled',
      message: `Bin widths (${used.toFixed(3)}m) must equal available space (${span.toFixed(3)}m)`,
      rowId: row.id,
    })
    return { state: anyOverfill ? 'overfill' : 'row_gap', remainingSpanM, issues }
  }

  if (anyOverfill) return { state: 'overfill', remainingSpanM, issues }
  if (anyBinGap) return { state: 'bin_gap', remainingSpanM, issues }
  return { state: 'complete', remainingSpanM: 0, issues: [] }
}

export function validateRackFaceFill(
  rack: {
    width?: number | null
    inner?: { width?: number | null } | null
    sides?: Array<{ rows?: FaceFillRow[] | null }> | null
  },
): FaceFillIssue[] {
  const issues: FaceFillIssue[] = []
  for (const side of rack.sides ?? []) {
    for (const row of side.rows ?? []) {
      if (row?.isActive === false) continue
      issues.push(...rowFaceFillState(row, rack).issues)
    }
  }
  return issues
}

export function formatFaceFillIssues(issues: FaceFillIssue[], max = 3): string {
  if (issues.length === 0) return ''
  const lines = issues.slice(0, max).map((i) => i.message)
  if (issues.length > max) lines.push(`…and ${issues.length - max} more`)
  return lines.join(' · ')
}

/** Linear face-meter utilization for a row (occupied / available bin width). */
export function rowFaceUtilization(row: FaceFillRow): {
  occupiedM: number
  availableM: number
  percent: number
} {
  const bins = (row.bins ?? []).filter((b) => b?.isActive !== false)
  let occupiedM = 0
  let availableM = 0
  for (const bin of bins) {
    const w = Number(bin.width)
    if (!(w > 0)) continue
    availableM += w
    occupiedM += binFacingOccupied(bin.products)
  }
  const percent =
    availableM > 0 ? Math.max(0, Math.min(100, (occupiedM / availableM) * 100)) : 0
  return { occupiedM, availableM, percent }
}

/** Aggregate linear face-meter utilization across a rack (all sides/rows). */
export function rackFaceUtilization(rack: {
  sides?: Array<{ rows?: FaceFillRow[] | null }> | null
}): {
  occupiedM: number
  availableM: number
  percent: number
} {
  let occupiedM = 0
  let availableM = 0
  for (const side of rack.sides ?? []) {
    for (const row of side.rows ?? []) {
      if (row?.isActive === false) continue
      const u = rowFaceUtilization(row)
      occupiedM += u.occupiedM
      availableM += u.availableM
    }
  }
  const percent =
    availableM > 0 ? Math.max(0, Math.min(100, (occupiedM / availableM) * 100)) : 0
  return { occupiedM, availableM, percent }
}

const MIN_BIN_W = 0.08

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Proportionally resize bins so Σ(width) === rowSpan.
 * Min width prefers one facing of the bin's first SKU when present.
 */
export function redistributeBinWidthsToSpan<T extends FaceFillBin & { products?: FaceFillProduct[] | null }>(
  bins: T[],
  rowSpan: number,
): T[] {
  if (!(rowSpan > 0) || bins.length === 0) return bins
  const mins = bins.map((b) => {
    const skuW = Number(b.products?.[0]?.width)
    if (skuW > 0) return Math.max(MIN_BIN_W, skuW)
    return MIN_BIN_W
  })
  const shares = bins.map((b, i) => Math.max(mins[i], Number(b.width) > 0 ? Number(b.width) : mins[i]))
  const total = shares.reduce((a, b) => a + b, 0) || 1
  const scaled = shares.map((s, i) => Math.max(mins[i], (s / total) * rowSpan))
  let sum = scaled.reduce((a, b) => a + b, 0)
  if (sum > rowSpan && scaled.length > 0) {
    const factor = rowSpan / sum
    for (let i = 0; i < scaled.length; i++) scaled[i] = Math.max(mins[i], scaled[i] * factor)
    sum = scaled.reduce((a, b) => a + b, 0)
    if (sum > rowSpan) {
      scaled[scaled.length - 1] = Math.max(
        mins[scaled.length - 1],
        scaled[scaled.length - 1] - (sum - rowSpan),
      )
    }
  }
  return bins.map((b, i) => ({ ...b, width: round3(scaled[i]) }))
}

/** Set each product quantity to linear front facings that fill the bin (single-SKU preferred). */
export function fillBinFrontFacings<
  T extends FaceFillBin & { products?: Array<FaceFillProduct & { name?: string }> | null },
>(bin: T): T {
  const products = (bin.products ?? []).filter((p) => p?.isActive !== false)
  if (products.length === 0) return bin
  const binW = Number(bin.width)
  if (!(binW > 0)) return bin

  if (products.length === 1) {
    const p = products[0]
    const w = Number(p.width)
    const qty = suggestedFaceFacings(binW, w)
    if (qty < 1) return bin
    return {
      ...bin,
      products: [{ ...p, quantity: qty }],
    }
  }

  // Multi-SKU: keep relative shares but scale to fill face when underfilled.
  const occupied = binFacingOccupied(products)
  if (isFaceFilled(occupied, binW, minProductFacingWidth(products))) return bin
  // Assign remaining gap to the first product that still fits another facing.
  const next = products.map((p) => ({ ...p }))
  let used = binFacingOccupied(next)
  let guard = 0
  while (used + FACE_FILL_TOLERANCE_M < binW && guard < 500) {
    let grew = false
    for (const p of next) {
      const w = Number(p.width)
      if (!(w > 0)) continue
      if (used + w <= binW + FACE_FILL_TOLERANCE_M) {
        p.quantity = Math.max(0, Math.floor(Number(p.quantity) || 0)) + 1
        used += w
        grew = true
        if (isFaceFilled(used, binW, minProductFacingWidth(next))) break
      }
    }
    if (!grew) break
    guard += 1
  }
  return { ...bin, products: next }
}

/**
 * Size each bin from its SKU facing demand (width × quantity), then scale so
 * Σ widths === rowSpan (no empty shelf gap). Used after AI / reflow.
 */
export function resizeBinsByFacingDemand<
  T extends FaceFillBin & { products?: FaceFillProduct[] | null },
>(bins: T[], rowSpan: number): T[] {
  if (!(rowSpan > 0) || bins.length === 0) return bins
  const demands = bins.map((b) => {
    const occupied = binFacingOccupied(b.products)
    const skuW = minProductFacingWidth(b.products)
    const fromQty = occupied > 0 ? occupied : Number(b.width) > 0 ? Number(b.width) : MIN_BIN_W
    const minW = skuW > 0 ? Math.max(MIN_BIN_W, skuW) : MIN_BIN_W
    return Math.max(minW, fromQty)
  })
  return redistributeBinWidthsToSpan(
    bins.map((b, i) => ({ ...b, width: demands[i] })),
    rowSpan,
  )
}

/** Redistribute bin widths to row span, then fill front facings on every bin. */
export function applyLocalFaceFillToRow<
  T extends FaceFillRow & {
    bins?: Array<FaceFillBin & { products?: FaceFillProduct[] | null }> | null
  },
>(
  row: T,
  rack?: { inner?: { width?: number | null } | null; width?: number | null } | null,
): T {
  const span = rowSpanMeters(row, rack)
  if (span == null || !(span > 0)) return row
  const raw = [...(row.bins ?? [])]
  if (raw.length === 0) return { ...row, width: span, span }
  const sized = resizeBinsByFacingDemand(raw, span).map((b) => fillBinFrontFacings(b))
  // After qty fill, re-size once more so widths match new facing demand and still span the row.
  const bins = resizeBinsByFacingDemand(sized, span).map((b) => fillBinFrontFacings(b))
  return {
    ...row,
    width: span,
    span: span,
    bins,
  }
}

export function applyLocalFaceFillToRack<
  T extends {
    width?: number | null
    inner?: { width?: number | null } | null
    sides?: Array<{ rows?: FaceFillRow[] | null }> | null
  },
>(rack: T): T {
  return {
    ...rack,
    sides: (rack.sides ?? []).map((side) => ({
      ...side,
      rows: (side.rows ?? []).map((row) => applyLocalFaceFillToRow(row, rack)),
    })),
  }
}

