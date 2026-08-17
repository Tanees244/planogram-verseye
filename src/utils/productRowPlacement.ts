import type { PendingProductParams, Rack, Row } from '@/store/planogramStore'
import { resolveIsStackable } from '@/utils/stackableSku'
import {
  clampBinDepthToInner,
  clampRowSpanToInner,
} from '@/utils/rackBlueprintMapper'

export type RowPlacementContext = {
  rack: Rack
  row: Row
  rowSpan: number
  usedWidth: number
  remainingWidth: number
  rowHeight: number
  /** Usable shelf depth for packing (m). */
  availableDepth: number
}

/** Soft UI ceiling for steppers only — not a shelf capacity cap. */
export const PLACEMENT_QTY_SOFT_MAX = 9999

/** Width actually taken by SKU facings in this slot (empty slots count as 0). */
export function binContentWidthM(
  bin: {
    width?: number
    products?: Array<{ id?: string; width?: number; quantity?: number }> | null
  },
): number {
  const p = bin.products?.[0]
  if (!p) return 0
  const skuW = Number(p.width)
  const slotW = Number(bin.width)
  if (!(skuW > 0)) return Number.isFinite(slotW) && slotW > 0 ? slotW : 0
  const qty = Math.max(1, Math.floor(Number(p.quantity) || 1))
  const span = Number.isFinite(slotW) && slotW > 0 ? slotW : qty * skuW
  const cols = Math.max(1, maxFrontFacings(span, skuW) || qty)
  const usedCols = Math.min(cols, qty)
  return Math.round(usedCols * skuW * 1000) / 1000
}

/** Locate a row and free span (left→right after existing bins). */
export function findRowPlacementContext(
  racks: Rack[],
  rowId: string,
): RowPlacementContext | null {
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        if (row.id !== rowId) continue
        const rowSpan = clampRowSpanToInner(rack, row.width)
        // Unused leftover slot width (empty bins / oversized slots) is still
        // free for a new SKU even if Σ bin.width fills the shelf.
        const usedWidth = row.bins.reduce((sum, b) => sum + binContentWidthM(b), 0)
        const remainingWidth = Math.max(0, rowSpan - usedWidth - 0.001)
        const declaredHeight = Number(row.height) || 0.4
        const rowHeight = usableShelfHeightM(side.rows, row, declaredHeight)
        const availableDepth = clampBinDepthToInner(
          rack,
          row.depth != null && Number(row.depth) > 0 ? Number(row.depth) : null,
          row.id,
        )
        return {
          rack,
          row,
          rowSpan,
          usedWidth,
          remainingWidth,
          rowHeight,
          availableDepth,
        }
      }
    }
  }
  return null
}

/**
 * Vertical space this shelf actually has: declared row height, capped by
 * the gap to the shelf above so stacks cannot punch through the next board.
 */
export function usableShelfHeightM(
  rows: Array<{ id: string; height?: number; yStart?: number | null }>,
  row: { id: string; height?: number; yStart?: number | null },
  declaredHeight?: number,
): number {
  const declared =
    declaredHeight != null && Number.isFinite(declaredHeight) && declaredHeight > 0
      ? declaredHeight
      : Number(row.height) || 0.4
  const idx = rows.findIndex((r) => r.id === row.id)
  if (idx < 0) return declared
  const y0 = row.yStart != null && Number.isFinite(Number(row.yStart)) ? Number(row.yStart) : null
  const next = rows[idx + 1]
  const y1 =
    next?.yStart != null && Number.isFinite(Number(next.yStart)) ? Number(next.yStart) : null
  if (y0 != null && y1 != null && y1 > y0 + 0.05) {
    const gap = y1 - y0 - 0.05
    if (gap > 0.08) return Math.min(declared, gap)
  }
  return declared
}

/**
 * Left vs right from a click/drop along the shelf (row-local X, 0 = center).
 * Uses the midpoint of remaining free span so a click on the right of an
 * empty (or leftover) gap places against the right edge.
 */
export function inferPlacementAnchor(
  localX: number,
  rowSpan: number,
  bins: Array<{
    width?: number
    anchor?: 'left' | 'right'
    products?: Array<{ id?: string; width?: number; quantity?: number }>
  }>,
): 'left' | 'right' {
  const span = Number.isFinite(rowSpan) && rowSpan > 0 ? rowSpan : 1
  const half = span / 2
  let xLeft = -half
  let xRight = half
  for (const b of bins) {
    const w = Array.isArray(b.products)
      ? binContentWidthM({ width: b.width, products: b.products })
      : Number(b.width) || 0
    if (!(w > 0)) continue
    if (b.anchor === 'right') xRight -= w
    else xLeft += w
  }
  const mid = (xLeft + xRight) / 2
  return localX >= mid ? 'right' : 'left'
}

export function maxFrontFacings(
  remainingWidth: number,
  skuWidth: number,
): number {
  if (!(remainingWidth > 0) || !(skuWidth > 0)) return 0
  return Math.max(0, Math.floor(remainingWidth / skuWidth + 1e-6))
}

export function maxDepthRows(
  availableDepth: number,
  skuDepth: number,
): number {
  if (!(availableDepth > 0) || !(skuDepth > 0)) return 0
  return Math.max(0, Math.floor(availableDepth / skuDepth + 1e-6))
}

export function maxStackLayers(
  rowHeight: number,
  skuHeight: number,
  stackable: boolean,
): number {
  if (!(rowHeight > 0) || !(skuHeight > 0)) return 0
  if (!stackable) return skuHeight <= rowHeight + 1e-6 ? 1 : 0
  return Math.max(0, Math.floor(rowHeight / skuHeight + 1e-6))
}

/** Default pack: a single unit at the front. Use steppers to add facings / depth / stack. */
export function defaultFacingsDepthStack(
  product: PendingProductParams,
  remainingWidth: number,
  availableDepth: number,
  rowHeight: number,
): {
  facings: number
  depth: number
  stack: number
  maxFacings: number
  maxDepth: number
  maxStack: number
} {
  const stackable = resolveIsStackable(product.id, { isStackable: product.isStackable })
  const maxFacings = maxFrontFacings(remainingWidth, product.width)
  const maxDepth = maxDepthRows(availableDepth, product.depth)
  const maxStack = maxStackLayers(rowHeight, product.height, stackable)
  return {
    facings: 1,
    depth: 1,
    stack: 1,
    maxFacings,
    maxDepth,
    maxStack,
  }
}

/** @deprecated Prefer defaultFacingsDepthStack */
export function defaultFacingsAndStack(
  product: PendingProductParams,
  remainingWidth: number,
  rowHeight: number,
): { facings: number; stack: number; maxFacings: number; maxStack: number } {
  const d = defaultFacingsDepthStack(product, remainingWidth, product.depth, rowHeight)
  return {
    facings: d.facings,
    stack: d.stack,
    maxFacings: d.maxFacings,
    maxStack: d.maxStack,
  }
}

export function quantityFromPack(
  facings: number,
  depth: number,
  stack: number,
): number {
  return Math.max(
    1,
    Math.floor(facings) * Math.floor(depth) * Math.floor(stack),
  )
}

/** @deprecated Prefer quantityFromPack */
export function quantityFromFacingsStack(facings: number, stack: number): number {
  return quantityFromPack(facings, 1, stack)
}

/**
 * Bin size for a W×D×H facing pack.
 * Height is hard-capped to the shelf; a pack taller than the opening does not fit.
 */
export function binDimsForPack(
  product: PendingProductParams,
  facings: number,
  depthRows: number,
  stack: number,
  remainingWidth: number,
  availableDepth: number,
  rowHeight: number,
): { width: number; depth: number; height: number; fits: boolean; reason?: string } {
  const f = Math.max(1, Math.floor(facings))
  const d = Math.max(1, Math.floor(depthRows))
  const s = Math.max(1, Math.floor(stack))

  const wantW = f * product.width
  const wantD = d * product.depth
  const wantH = s * product.height

  const width =
    Math.round(Math.min(Math.max(wantW, product.width), Math.max(remainingWidth, product.width)) * 1000) /
    1000
  const depth =
    Math.round(Math.min(Math.max(wantD, product.depth), Math.max(availableDepth, product.depth)) * 1000) /
    1000
  const height =
    Math.round(Math.min(Math.max(wantH, product.height), Math.max(rowHeight, 0.05)) * 1000) / 1000

  if (!(remainingWidth >= product.width - 1e-6)) {
    return { width, depth, height, fits: false, reason: 'Shelf is full — no free width for this SKU' }
  }
  if (!(availableDepth >= product.depth - 1e-6)) {
    const skuCm = Math.round(product.depth * 100)
    const shelfCm = Math.round(Math.max(0, availableDepth) * 100)
    return {
      width,
      depth,
      height,
      fits: false,
      reason: `Shelf is too shallow — this SKU is ${skuCm} cm front-to-back, the shelf is only ${shelfCm} cm deep`,
    }
  }
  if (wantH > rowHeight + 1e-6) {
    const skuCm = Math.round(product.height * 100)
    const wantCm = Math.round(wantH * 100)
    const shelfCm = Math.round(Math.max(0, rowHeight) * 100)
    return {
      width,
      depth,
      height,
      fits: false,
      reason:
        s > 1
          ? `Stack is too tall — ${s} × ${skuCm} cm = ${wantCm} cm, this shelf is only ${shelfCm} cm high`
          : `SKU is taller than this shelf — SKU ${skuCm} cm, shelf ${shelfCm} cm`,
    }
  }

  const hints: string[] = []
  if (wantW > remainingWidth + 1e-6) hints.push('front exceeds free width')
  if (wantD > availableDepth + 1e-6) hints.push('depth exceeds shelf')

  return {
    width,
    depth,
    height,
    fits: true,
    reason: hints.length ? `Pack larger than shelf (${hints.join(', ')}) — bin clamped` : undefined,
  }
}

export type RemainingRowFillPlan = {
  width: number
  depth: number
  height: number
  quantity: number
  facings: number
  depthRows: number
  stack: number
}

/**
 * Size the slot to free shelf cavity and count units that fill W × D × H.
 */
export function remainingRowFillPlan(
  product: PendingProductParams,
  pack: { facings: number; depth: number; stack: number },
  remainingWidth: number,
  availableDepth: number,
  rowHeight: number,
  fillRemaining: boolean,
): RemainingRowFillPlan {
  const stackable = resolveIsStackable(product.id, { isStackable: product.isStackable })
  if (!fillRemaining) {
    const stack = Math.min(stackable ? pack.stack : 1, Math.max(maxStackLayers(rowHeight, product.height, stackable), 1))
    const sized = binDimsForPack(
      product,
      pack.facings,
      pack.depth,
      stack,
      remainingWidth,
      availableDepth,
      rowHeight,
    )
    return {
      width: sized.width,
      depth: sized.depth,
      height: sized.height,
      quantity: quantityFromPack(pack.facings, pack.depth, stack),
      facings: pack.facings,
      depthRows: pack.depth,
      stack,
    }
  }

  const facings = Math.max(1, maxFrontFacings(remainingWidth, product.width))
  const depthRows = Math.max(1, maxDepthRows(availableDepth, product.depth))
  const stack = Math.max(1, maxStackLayers(rowHeight, product.height, stackable))
  return {
    width: Math.round(Math.max(remainingWidth, product.width) * 1000) / 1000,
    depth: Math.round(Math.min(Math.max(depthRows * product.depth, product.depth), Math.max(availableDepth, product.depth)) * 1000) / 1000,
    height: Math.round(Math.min(Math.max(stack * product.height, product.height), Math.max(rowHeight, product.height)) * 1000) / 1000,
    quantity: quantityFromPack(facings, depthRows, stack),
    facings,
    depthRows,
    stack,
  }
}

/**
 * Lay a copied unit count into free shelf cavity (width first, then depth, then stack).
 * Clamps to what fits; does not fill leftover cavity beyond the copied quantity.
 */
export function packQuantityIntoCavity(
  product: PendingProductParams,
  quantity: number,
  remainingWidth: number,
  availableDepth: number,
  rowHeight: number,
): {
  fits: boolean
  reason?: string
  facings: number
  depth: number
  stack: number
  quantity: number
} {
  const stackable = resolveIsStackable(product.id, { isStackable: product.isStackable })
  const maxF = maxFrontFacings(remainingWidth, product.width)
  const maxD = maxDepthRows(availableDepth, product.depth)
  const maxS = maxStackLayers(rowHeight, product.height, stackable)
  if (maxF < 1) {
    return {
      fits: false,
      reason: 'Shelf is full — no free width for this SKU',
      facings: 0,
      depth: 0,
      stack: 0,
      quantity: 0,
    }
  }
  if (maxD < 1) {
    const skuCm = Math.round(product.depth * 100)
    const shelfCm = Math.round(Math.max(0, availableDepth) * 100)
    return {
      fits: false,
      reason: `Shelf is too shallow — this SKU is ${skuCm} cm front-to-back, the shelf is only ${shelfCm} cm deep`,
      facings: 0,
      depth: 0,
      stack: 0,
      quantity: 0,
    }
  }
  if (maxS < 1) {
    const skuCm = Math.round(product.height * 100)
    const shelfCm = Math.round(Math.max(0, rowHeight) * 100)
    return {
      fits: false,
      reason: `SKU is taller than this shelf — SKU ${skuCm} cm, shelf ${shelfCm} cm`,
      facings: 0,
      depth: 0,
      stack: 0,
      quantity: 0,
    }
  }

  const maxFit = quantityFromPack(maxF, maxD, maxS)
  const n = Math.max(1, Math.min(Math.floor(quantity) || 1, maxFit))
  let facings = Math.min(maxF, n)
  let depth = Math.min(maxD, Math.max(1, Math.ceil(n / facings)))
  let stack = Math.min(maxS, Math.max(1, Math.ceil(n / (facings * depth))))
  while (facings * depth * stack < n) {
    if (depth < maxD) depth += 1
    else if (facings < maxF) facings += 1
    else if (stack < maxS) stack += 1
    else break
  }
  return {
    fits: true,
    facings,
    depth,
    stack,
    quantity: Math.min(n, facings * depth * stack),
  }
}

/** Front × depth × stack that fit in an existing slot (after it has been widened). */
export function autofillQuantityForSlot(
  binWidthM: number,
  binDepthM: number,
  binHeightM: number,
  skuWidthM: number,
  skuDepthM: number,
  skuHeightM: number,
  stackable: boolean,
): number {
  const facings = Math.max(1, maxFrontFacings(binWidthM, skuWidthM))
  const depth = Math.max(1, maxDepthRows(binDepthM, skuDepthM))
  const stack = Math.max(1, maxStackLayers(binHeightM, skuHeightM, stackable))
  return quantityFromPack(facings, depth, stack)
}

/** @deprecated Prefer binDimsForPack */
export function binDimsForFacingsStack(
  product: PendingProductParams,
  facings: number,
  stack: number,
  remainingWidth: number,
  rowHeight: number,
): { width: number; depth: number; height: number; fits: boolean; reason?: string } {
  return binDimsForPack(
    product,
    facings,
    1,
    stack,
    remainingWidth,
    Math.max(product.depth, 0.05),
    rowHeight,
  )
}
