/**
 * Cascading layout recompute when rack outer / shell changes.
 *
 * Chain (all meters):
 *   outer.width − 2×wallThickness  →  inner.width
 *   inner.width                    ≥  row.span
 *   row.span                       ≥  Σ bin.width
 *   bin.width                      ≥  Σ (product.width × quantity)
 *
 * Rows/bins rescale by proportional share; facings use largest-remainder
 * with min/max clamp. Exceptions are returned (never dropped silently).
 */

import type { CustomRackConfig } from '@/components/fixtures/customRackTypes'
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes'
import type { Bin, Product, Rack, Row } from '@/store/planogramStore'
import { resolveRackInner, resolveRackOuter } from '@/utils/rackBlueprintMapper'
import { fillBinFrontFacings as fillBinFrontFacingsLocal } from '@/utils/faceFill'

export type CascadeExceptionCode =
  | 'row_span_clamped'
  | 'bin_width_clamped'
  | 'facings_reduced'
  | 'facings_min_floor'
  | 'overflow_unresolved'

export interface CascadeException {
  code: CascadeExceptionCode
  message: string
  rackId?: string
  rowId?: string
  binId?: string
  productId?: string
}

export interface CascadeResult {
  rack: Rack
  exceptions: CascadeException[]
}

const MIN_ROW_H = 0.15
const MIN_BIN_W = 0.08
const MIN_FACINGS = 1

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function productFacings(p: Product): number {
  return Math.max(1, Math.floor(Number(p.quantity) || 1))
}

function occupiedWidth(products: Product[]): number {
  return products.reduce((sum, p) => sum + safePositive(p.width) * productFacings(p), 0)
}

function safePositive(n: unknown, fallback = 0.01): number {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? v : fallback
}

/** Largest-remainder distribution of integer seats across items with fractional quotas. */
export function allocateLargestRemainder(
  weights: number[],
  seats: number,
  minEach = 0,
  maxEach?: number,
): number[] {
  const n = weights.length
  if (n === 0) return []
  const totalW = weights.reduce((a, b) => a + Math.max(0, b), 0)
  if (seats <= 0 || totalW <= 0) {
    return weights.map(() => minEach)
  }

  const raw = weights.map((w) => (Math.max(0, w) / totalW) * seats)
  const floor = raw.map((v) => Math.floor(v))
  let assigned = floor.reduce((a, b) => a + b, 0)
  const rem = raw.map((v, i) => ({ i, frac: v - floor[i] }))
  rem.sort((a, b) => b.frac - a.frac)

  const out = [...floor]
  let idx = 0
  while (assigned < seats && rem.length > 0) {
    out[rem[idx % rem.length].i] += 1
    assigned += 1
    idx += 1
  }

  // Apply min/max clamps, then rebalance if needed
  for (let i = 0; i < n; i++) {
    if (out[i] < minEach) out[i] = minEach
    if (maxEach != null && out[i] > maxEach) out[i] = maxEach
  }

  let sum = out.reduce((a, b) => a + b, 0)
  // Trim excess from largest first
  while (sum > seats) {
    let best = -1
    let bestVal = -1
    for (let i = 0; i < n; i++) {
      if (out[i] > minEach && out[i] > bestVal) {
        bestVal = out[i]
        best = i
      }
    }
    if (best < 0) break
    out[best] -= 1
    sum -= 1
  }
  // Fill shortfall to largest fractional remainders that can grow
  while (sum < seats) {
    let best = -1
    let bestFrac = -1
    for (let i = 0; i < n; i++) {
      if (maxEach != null && out[i] >= maxEach) continue
      const frac = rem.find((r) => r.i === i)?.frac ?? 0
      if (frac > bestFrac || best < 0) {
        bestFrac = frac
        best = i
      }
    }
    if (best < 0) break
    out[best] += 1
    sum += 1
  }

  return out
}

function recomputeInnerFromOuter(rack: Rack): {
  width: number
  depth: number
  height: number
  wallThickness: number
} {
  if (rack.customConfig) {
    const d = computeCustomRackDimensions(rack.customConfig)
    return {
      width: d.innerWidth,
      depth: d.innerDepth,
      height: d.innerHeight,
      wallThickness: rack.customConfig.wallThickness,
    }
  }
  const outer = resolveRackOuter(rack)
  const wallT = safePositive(rack.shell?.wallThickness ?? 0.08, 0.08)
  const headerH = rack.shell?.header?.enabled ? safePositive(rack.shell.header.height, 0) : 0
  const footerH = rack.shell?.footer?.enabled ? safePositive(rack.shell.footer.height, 0) : 0
  return {
    width: Math.max(0.1, outer.width - 2 * wallT),
    depth: Math.max(0.1, outer.depth - 2 * wallT),
    height: Math.max(0.1, outer.height - headerH - footerH - wallT),
    wallThickness: wallT,
  }
}

function rescaleRowHeights(rows: Row[], innerHeight: number, exceptions: CascadeException[], rackId: string): Row[] {
  if (rows.length === 0) return rows
  const shares = rows.map((r) => Math.max(MIN_ROW_H, safePositive(r.height, MIN_ROW_H)))
  const total = shares.reduce((a, b) => a + b, 0)
  const target = Math.max(MIN_ROW_H * rows.length, innerHeight)
  return rows.map((row, i) => {
    const nextH = round3(Math.max(MIN_ROW_H, (shares[i] / total) * target))
    if (nextH + 0.001 < row.height) {
      exceptions.push({
        code: 'row_span_clamped',
        message: `Row height reduced ${row.height.toFixed(2)} → ${nextH.toFixed(2)} m to fit inner height`,
        rackId,
        rowId: row.id,
      })
    }
    return { ...row, height: nextH }
  })
}

function rescaleBins(
  row: Row,
  rowSpan: number,
  exceptions: CascadeException[],
  rackId: string,
): Row {
  const bins = row.bins
  if (bins.length === 0) return { ...row, width: rowSpan }

  const shares = bins.map((b) => Math.max(MIN_BIN_W, safePositive(b.width, MIN_BIN_W)))
  const total = shares.reduce((a, b) => a + b, 0)
  const scaled = shares.map((s) => Math.max(MIN_BIN_W, (s / total) * rowSpan))

  // Fix rounding so Σ bin.width ≤ rowSpan
  let sum = scaled.reduce((a, b) => a + b, 0)
  if (sum > rowSpan && scaled.length > 0) {
    const factor = rowSpan / sum
    for (let i = 0; i < scaled.length; i++) {
      scaled[i] = Math.max(MIN_BIN_W, scaled[i] * factor)
    }
    sum = scaled.reduce((a, b) => a + b, 0)
    if (sum > rowSpan) {
      scaled[scaled.length - 1] = Math.max(MIN_BIN_W, scaled[scaled.length - 1] - (sum - rowSpan))
    }
  }

  const nextBins = bins.map((bin, i) => {
    const nextW = round3(scaled[i])
    if (nextW + 0.001 < bin.width) {
      exceptions.push({
        code: 'bin_width_clamped',
        message: `Bin width reduced ${bin.width.toFixed(2)} → ${nextW.toFixed(2)} m (row span ${rowSpan.toFixed(2)} m)`,
        rackId,
        rowId: row.id,
        binId: bin.id,
      })
    }
    return { ...bin, width: nextW }
  })

  return { ...row, width: rowSpan, bins: nextBins }
}

function reintegeriseFacings(
  bin: Bin,
  exceptions: CascadeException[],
  rackId: string,
  rowId: string,
): Bin {
  const products = bin.products
  if (products.length === 0) return bin

  const widths = products.map((p) => safePositive(p.width))
  const current = products.map(productFacings)
  const need = widths.reduce((s, w, i) => s + w * current[i], 0)

  if (need <= bin.width + 0.001) return bin

  // Max facings that would fit if each SKU got exclusive space (upper bound per item)
  const maxEach = products.map((p, i) =>
    Math.max(MIN_FACINGS, Math.floor(bin.width / widths[i])),
  )

  // Ideal continuous quotas proportional to current counts, scaled to fit
  const capacity = Math.max(0, bin.width)
  const idealSeats = Math.max(
    products.length * MIN_FACINGS,
    Math.floor(capacity / Math.min(...widths)),
  )

  // Prefer reducing proportionally from current quantities
  const weights = current.map((c) => Math.max(MIN_FACINGS, c))
  let nextQty = allocateLargestRemainder(weights, idealSeats, MIN_FACINGS)

  // Clamp each so width × qty ≤ bin.width when alone is fine; then shrink until sum fits
  nextQty = nextQty.map((q, i) => Math.min(q, maxEach[i]))

  const fits = (qty: number[]) =>
    widths.reduce((s, w, i) => s + w * qty[i], 0) <= bin.width + 0.001

  let guard = 0
  while (!fits(nextQty) && guard < 200) {
    let best = -1
    let bestWaste = -1
    for (let i = 0; i < nextQty.length; i++) {
      if (nextQty[i] <= MIN_FACINGS) continue
      const waste = widths[i] // reducing this frees the most absolute width per step
      if (waste > bestWaste) {
        bestWaste = waste
        best = i
      }
    }
    if (best < 0) break
    nextQty[best] -= 1
    guard += 1
  }

  if (!fits(nextQty)) {
    exceptions.push({
      code: 'overflow_unresolved',
      message: `Bin ${bin.binName || bin.id.slice(0, 8)} still overflows after min facings — Σ(product.width×qty) > bin.width (${bin.width.toFixed(2)} m)`,
      rackId,
      rowId,
      binId: bin.id,
    })
  }

  const nextProducts = products.map((p, i) => {
    const prev = current[i]
    const next = nextQty[i]
    if (next < prev) {
      exceptions.push({
        code: 'facings_reduced',
        message: `${p.name}: facings ${prev} → ${next} to fit bin width ${bin.width.toFixed(2)} m`,
        rackId,
        rowId,
        binId: bin.id,
        productId: p.id,
      })
    } else if (next === MIN_FACINGS && prev === MIN_FACINGS && !fits(nextQty)) {
      exceptions.push({
        code: 'facings_min_floor',
        message: `${p.name}: held at minimum ${MIN_FACINGS} facing but still overflows`,
        rackId,
        rowId,
        binId: bin.id,
        productId: p.id,
      })
    }
    return { ...p, quantity: next }
  })

  return { ...bin, products: nextProducts }
}

/**
 * Recompute inner cavity from outer/shell, then cascade row spans → bin widths → facings.
 */
export function cascadeRescaleRack(rack: Rack): CascadeResult {
  const exceptions: CascadeException[] = []
  const inner = recomputeInnerFromOuter(rack)
  const outer = resolveRackOuter(rack)

  // Seed inner on rack for API / UI
  let next: Rack = {
    ...rack,
    width: outer.width,
    depth: outer.depth,
    inner: {
      width: round3(inner.width),
      depth: round3(inner.depth),
      height: round3(inner.height),
    },
    outer: {
      width: outer.width,
      depth: outer.depth,
      height: outer.height,
    },
  }

  next = {
    ...next,
    sides: next.sides.map((side) => {
      let rows = rescaleRowHeights(side.rows, inner.height, exceptions, rack.id)
      rows = rows.map((row) => {
        const prevSpan = safePositive(row.width, inner.width)
        const span = round3(Math.min(prevSpan, inner.width - 0.001))
        if (span + 0.001 < prevSpan) {
          exceptions.push({
            code: 'row_span_clamped',
            message: `Row span clamped ${prevSpan.toFixed(2)} → ${span.toFixed(2)} m (inner.width ${inner.width.toFixed(2)} m)`,
            rackId: rack.id,
            rowId: row.id,
          })
        }
        // Preserve height share relative to previous when only width changes
        let withSpan = rescaleBins({ ...row, width: span }, span, exceptions, rack.id)
        withSpan = {
          ...withSpan,
          bins: withSpan.bins.map((b) => {
            const shrunk = reintegeriseFacings(b, exceptions, rack.id, row.id)
            // Fill underfilled front face (Exact Face Fill) after shrink-to-fit.
            return fillBinFrontFacingsLocal(shrunk)
          }),
        }
        return withSpan
      })
      return { ...side, rows }
    }),
  }

  return { rack: next, exceptions }
}

/** Validate hierarchy inequalities without mutating. */
export function validateLayoutHierarchy(rack: Rack): CascadeException[] {
  const exceptions: CascadeException[] = []
  const inner = resolveRackInner(rack)
  for (const side of rack.sides) {
    for (const row of side.rows) {
      const span = safePositive(row.width, inner.width)
      if (span > inner.width + 0.001) {
        exceptions.push({
          code: 'row_span_clamped',
          message: `row.span ${span.toFixed(2)} > inner.width ${inner.width.toFixed(2)}`,
          rackId: rack.id,
          rowId: row.id,
        })
      }
      const binSum = row.bins.reduce((s, b) => s + safePositive(b.width), 0)
      if (binSum > span + 0.001) {
        exceptions.push({
          code: 'bin_width_clamped',
          message: `Σ bin.width ${binSum.toFixed(2)} > row.span ${span.toFixed(2)}`,
          rackId: rack.id,
          rowId: row.id,
        })
      }
      for (const bin of row.bins) {
        const prodSum = occupiedWidth(bin.products)
        if (prodSum > bin.width + 0.001) {
          exceptions.push({
            code: 'overflow_unresolved',
            message: `Σ(product.width×qty) ${prodSum.toFixed(2)} > bin.width ${bin.width.toFixed(2)}`,
            rackId: rack.id,
            rowId: row.id,
            binId: bin.id,
          })
        }
      }
    }
  }
  return exceptions
}

export function productFacingWidth(product: { width: number; quantity?: number }): number {
  return safePositive(product.width) * Math.max(1, Math.floor(Number(product.quantity) || 1))
}

export function binOccupiedFacingWidth(products: Product[]): number {
  return occupiedWidth(products)
}

/** Apply custom config and cascade content to match new outer/inner. */
export function applyCustomConfigWithCascade(
  rack: Rack,
  config: CustomRackConfig,
): CascadeResult {
  const patched: Rack = {
    ...rack,
    customConfig: config,
    isDoubleSided: Boolean(config.isDoubleSided),
    width: config.outerWidth,
    depth: config.outerDepth,
    outer: {
      width: config.outerWidth,
      depth: config.outerDepth,
      height: config.outerHeight,
    },
    shell: {
      wallThickness: config.wallThickness,
      header: {
        enabled: config.header.enabled,
        width: config.header.width > 0 ? config.header.width : null,
        depth: config.header.depth > 0 ? config.header.depth : null,
        height: config.header.height,
        protrusion: config.header.protrusion,
        color: config.header.color,
        emissive: config.header.emissive ?? null,
      },
      footer: {
        enabled: config.footer.enabled,
        width: config.footer.width > 0 ? config.footer.width : null,
        depth: config.footer.depth > 0 ? config.footer.depth : null,
        height: config.footer.height,
        protrusion: config.footer.protrusion,
        color: config.footer.color,
        emissive: config.footer.emissive ?? null,
      },
      walls: config.walls,
      frame: rack.shell?.frame ?? {
        cornerPosts: null,
        topRail: null,
        innerFloor: null,
      },
      materials: rack.shell?.materials ?? {
        accentColor: config.accentColor,
        wallColor: null,
        postColor: null,
      },
    },
  }
  return cascadeRescaleRack(patched)
}
