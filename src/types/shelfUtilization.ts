/** Shared shelf / row facing utilization (API + client). */

export type ShelfFacingUtilizationStatus =
  | 'ok'
  | 'over_capacity'
  | 'dimensions_unavailable'

export type ShelfFacingUtilization = {
  availableWidthMeters: number | null
  occupiedWidthMeters: number
  remainingWidthMeters: number | null
  utilizationPercent: number
  fits: boolean
  isOverCapacity: boolean
  canCalculate: boolean
  status: ShelfFacingUtilizationStatus
}

export type ShelfRowUtilization = {
  rowId: string
  rowNumber: number | null
  utilization: ShelfFacingUtilization
}

/** Normalize API utilization payloads (tolerates snake_case / partial). */
export function normalizeShelfFacingUtilization(
  raw: unknown,
): ShelfFacingUtilization | null {
  if (!raw || typeof raw !== 'object') return null
  const u = raw as Record<string, unknown>
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const available =
    num(u.availableWidthMeters) ?? num(u.available_width_meters) ?? num(u.availableWidth)
  const occupied =
    num(u.occupiedWidthMeters) ??
    num(u.occupied_width_meters) ??
    num(u.occupiedWidth) ??
    0
  const remaining =
    num(u.remainingWidthMeters) ??
    num(u.remaining_width_meters) ??
    (available != null ? available - occupied : null)
  const canCalculate =
    typeof u.canCalculate === 'boolean'
      ? u.canCalculate
      : typeof u.can_calculate === 'boolean'
        ? Boolean(u.can_calculate)
        : available != null && available > 0
  const percentRaw =
    num(u.utilizationPercent) ?? num(u.utilization_percent) ?? num(u.percent)
  const utilizationPercent = canCalculate
    ? percentRaw != null
      ? percentRaw
      : available && available > 0
        ? Math.min(999, (occupied / available) * 100)
        : 0
    : 0
  const isOverCapacity =
    typeof u.isOverCapacity === 'boolean'
      ? u.isOverCapacity
      : typeof u.is_over_capacity === 'boolean'
        ? Boolean(u.is_over_capacity)
        : canCalculate && available != null
          ? occupied > available + 1e-6
          : false
  const fits =
    typeof u.fits === 'boolean' ? u.fits : canCalculate ? !isOverCapacity : false
  const statusRaw = String(u.status ?? '')
  const status: ShelfFacingUtilizationStatus =
    statusRaw === 'over_capacity' || statusRaw === 'dimensions_unavailable' || statusRaw === 'ok'
      ? statusRaw
      : !canCalculate
        ? 'dimensions_unavailable'
        : isOverCapacity
          ? 'over_capacity'
          : 'ok'

  return {
    availableWidthMeters: available,
    occupiedWidthMeters: occupied,
    remainingWidthMeters: remaining,
    utilizationPercent,
    fits,
    isOverCapacity,
    canCalculate,
    status,
  }
}
