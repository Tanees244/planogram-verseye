import type { Rack, RackSide, Row } from '@/store/planogramStore'
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes'
import { resolveRackInner, resolveRackOuter } from '@/utils/rackBlueprintMapper'
import { formatCm } from '@/utils/lengthUnits'

/** Sum of row heights on a side (meters). */
export function sumRowHeights(rows: Row[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.height) || 0), 0)
}

/** Used vertical stack based on anchors when present (matches server stacking). */
export function usedRowStackHeight(side: RackSide): number {
  if (side.rows.length === 0) return 0
  let stackEnd = 0
  let hasAnchors = false
  for (const row of side.rows) {
    const h = Number(row.height) || 0
    if (row.yEnd != null && Number.isFinite(row.yEnd)) {
      hasAnchors = true
      stackEnd = Math.max(stackEnd, row.yEnd)
    } else if (row.yStart != null && Number.isFinite(row.yStart)) {
      hasAnchors = true
      stackEnd = Math.max(stackEnd, row.yStart + h)
    }
  }
  if (hasAnchors) return stackEnd
  return sumRowHeights(side.rows)
}

/** Next yStart for a new row on this side. */
export function nextRowYStart(side: RackSide): number {
  return usedRowStackHeight(side)
}

/** Usable vertical stack inside the rack cavity (meters). */
export function resolveUsableRowStackHeight(rack: Rack): number {
  const inner = resolveRackInner(rack)
  if (rack.customConfig) {
    return Math.max(0.1, inner.height)
  }
  const outer = resolveRackOuter(rack)
  const headerH = rack.shell?.header?.enabled ? Number(rack.shell.header.height) || 0 : 0
  const footerH = rack.shell?.footer?.enabled ? Number(rack.shell.footer.height) || 0 : 0
  return Math.max(0.1, outer.height - headerH - footerH)
}

export function canAddRowToSide(
  rack: Rack,
  side: RackSide,
  newHeight: number,
): { ok: boolean; message?: string; usable: number; used: number; remaining: number } {
  const usable = resolveUsableRowStackHeight(rack)
  const used = usedRowStackHeight(side)
  const remaining = Math.max(0, usable - used)
  const total = used + newHeight
  if (total > usable + 0.001) {
    return {
      ok: false,
      usable,
      used,
      remaining,
      message: `Row heights (${formatCm(total)}) exceed available space (${formatCm(usable)}). ${remaining > 0 ? `Remaining: ${formatCm(remaining)}.` : 'No space left.'}`,
    }
  }
  return { ok: true, usable, used, remaining }
}

/** Recompute yStart/yEnd for contiguous stacked rows. */
export function reanchorSideRows(rows: Row[]): Row[] {
  let y = 0
  return rows.map((row) => {
    const h = Number(row.height) || 0
    const anchored = { ...row, yStart: y, yEnd: y + h }
    y += h
    return anchored
  })
}

/**
 * True when every row has a finite yStart and anchors are strictly stacked
 * (non-decreasing starts, no total collapse to the same floor).
 */
export function areRowAnchorsUsable(rows: Row[]): boolean {
  if (rows.length <= 1) return true
  const starts = rows.map((r) =>
    r.yStart != null && Number.isFinite(r.yStart) ? Number(r.yStart) : null,
  )
  if (starts.some((s) => s == null)) return false
  // All anchored at 0 (or identical) → treat as missing and re-stack
  const unique = new Set(starts as number[])
  if (unique.size === 1) return false
  for (let i = 1; i < starts.length; i++) {
    const prev = starts[i - 1] as number
    const cur = starts[i] as number
    const prevH = Number(rows[i - 1]?.height) || 0
    // Allow tiny float error; require each next shelf to start at/after previous end
    if (cur + 0.001 < prev) return false
    if (cur + 0.001 < prev + prevH * 0.5) return false
  }
  return true
}

/** Ensure rows have contiguous yStart/yEnd when API anchors are missing or collapsed. */
export function ensureRowAnchors(rows: Row[]): Row[] {
  if (areRowAnchorsUsable(rows)) return rows
  return reanchorSideRows(rows)
}

/**
 * World Y (relative to rack origin + bodyFloorY) for each row center.
 * Prefer stored anchors when valid; otherwise stack by array order from the floor.
 */
export function rowCenterOffsetsFromFloor(rows: Row[]): number[] {
  const anchored = ensureRowAnchors(rows)
  return anchored.map((row) => {
    const h = Number(row.height) || 0
    const yStart = row.yStart != null && Number.isFinite(row.yStart) ? Number(row.yStart) : 0
    return yStart + h / 2
  })
}

/** Persist inner cavity on custom racks after create/load. */
export function innerFromCustomConfig(rack: Rack) {
  if (!rack.customConfig) return null
  const d = computeCustomRackDimensions(rack.customConfig)
  return { width: d.innerWidth, depth: d.innerDepth, height: d.innerHeight }
}
