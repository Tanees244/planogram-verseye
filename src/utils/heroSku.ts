/**
 * Hero SKU + eye-level placement (frontend policy).
 * Backend eye-facing flag is not shipped yet — we persist hero ids locally
 * and still send `isHero` on create when the API accepts extra fields.
 */

const STORAGE_KEY = 'planogram.heroSkuIds'

export const EYE_LEVEL_Y_MIN_M = 1.2
export const EYE_LEVEL_Y_MAX_M = 1.6

function readHeroSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const arr = raw ? (JSON.parse(raw) as string[]) : []
    return new Set(Array.isArray(arr) ? arr.filter(Boolean) : [])
  } catch {
    return new Set()
  }
}

function writeHeroSet(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* ignore */
  }
}

export function isHeroSkuId(skuId: string | null | undefined): boolean {
  if (!skuId) return false
  return readHeroSet().has(skuId)
}

export function setHeroSkuId(skuId: string, isHero: boolean) {
  const set = readHeroSet()
  if (isHero) set.add(skuId)
  else set.delete(skuId)
  writeHeroSet(set)
}

export function markHeroFromFlags(
  skuId: string,
  flags: { isHero?: boolean | null; heroSku?: boolean | null; isEyeFacing?: boolean | null },
) {
  if (flags.isHero || flags.heroSku || flags.isEyeFacing) setHeroSkuId(skuId, true)
}

/** Row vertical center from floor (meters), using yStart/yEnd or cumulative stack. */
export function rowEyeCenterY(
  row: { yStart?: number | null; yEnd?: number | null; height?: number | null },
  sideRows?: Array<{ id?: string; height?: number | null; yStart?: number | null }>,
  rowId?: string,
): number {
  if (row.yStart != null && row.yEnd != null && Number.isFinite(row.yStart) && Number.isFinite(row.yEnd)) {
    return (Number(row.yStart) + Number(row.yEnd)) / 2
  }
  if (row.yStart != null && row.height != null) {
    return Number(row.yStart) + Number(row.height) / 2
  }
  // Fallback: sum heights below this row
  if (sideRows && rowId) {
    let y = 0
    for (const r of sideRows) {
      const h = Number(r.height) || 0
      if (r.id === rowId) return y + h / 2
      y += h
    }
  }
  return Number(row.height) ? Number(row.height) / 2 : 0
}

export function isEyeLevelHeight(centerY: number): boolean {
  return centerY >= EYE_LEVEL_Y_MIN_M && centerY <= EYE_LEVEL_Y_MAX_M
}

/** Middle third of the side stack counts as eye-level when rack is short. */
export function isEyeLevelRow(
  row: { id?: string; yStart?: number | null; yEnd?: number | null; height?: number | null },
  sideRows: Array<{ id?: string; height?: number | null; yStart?: number | null; yEnd?: number | null }>,
): boolean {
  const center = rowEyeCenterY(row, sideRows, row.id)
  if (isEyeLevelHeight(center)) return true

  const totalH = sideRows.reduce((s, r) => s + (Number(r.height) || 0), 0)
  if (!(totalH > 0)) return false
  // Short racks: middle third
  if (totalH < EYE_LEVEL_Y_MAX_M + 0.2) {
    const lo = totalH / 3
    const hi = (2 * totalH) / 3
    return center >= lo && center <= hi
  }
  return false
}

export function findRowContextForBin(
  racks: Array<{
    sides: Array<{
      rows: Array<{
        id: string
        height?: number | null
        yStart?: number | null
        yEnd?: number | null
        bins: Array<{ id: string }>
      }>
    }>
  }>,
  binId: string,
): { row: { id: string; height?: number | null; yStart?: number | null; yEnd?: number | null }; sideRows: typeof racks[0]['sides'][0]['rows'] } | null {
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        if (row.bins.some((b) => b.id === binId)) {
          return { row, sideRows: side.rows }
        }
      }
    }
  }
  return null
}

export function heroPlacementBlocked(
  skuId: string | null | undefined,
  binId: string,
  racks: Parameters<typeof findRowContextForBin>[0],
): string | null {
  if (!skuId || !isHeroSkuId(skuId)) return null
  const ctx = findRowContextForBin(racks, binId)
  if (!ctx) return null
  if (isEyeLevelRow(ctx.row, ctx.sideRows)) return null
  return 'Hero SKUs can only be placed on eye-level rows (≈1.2–1.6 m from the floor, or the middle third of short racks).'
}
