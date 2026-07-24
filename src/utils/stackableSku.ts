/**
 * Stackable SKU flag.
 * Server default is `true`. We cache overrides locally and prefer catalog fields when present.
 */

const STORAGE_KEY = 'planogram.stackableSkuOverrides'

type OverrideMap = Record<string, boolean>

function readMap(): OverrideMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      // Migrate old Set-of-stackable-ids → only true overrides (unknown still default true).
      const legacy = window.localStorage.getItem('planogram.stackableSkuIds')
      if (legacy) {
        const arr = JSON.parse(legacy) as string[]
        const migrated: OverrideMap = {}
        if (Array.isArray(arr)) {
          for (const id of arr) {
            if (id) migrated[id] = true
          }
        }
        writeMap(migrated)
        return migrated
      }
      return {}
    }
    const parsed = JSON.parse(raw) as OverrideMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: OverrideMap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/** Resolve stackable: explicit product flag → local override → default true. */
export function resolveIsStackable(
  skuId: string | null | undefined,
  flags?: { isStackable?: boolean | null; stackable?: boolean | null },
): boolean {
  if (flags?.isStackable === true || flags?.stackable === true) return true
  if (flags?.isStackable === false || flags?.stackable === false) return false
  if (!skuId) return true
  const map = readMap()
  if (Object.prototype.hasOwnProperty.call(map, skuId)) return Boolean(map[skuId])
  return true
}

export function isStackableSkuId(skuId: string | null | undefined): boolean {
  return resolveIsStackable(skuId)
}

export function setStackableSkuId(skuId: string, stackable: boolean) {
  if (!skuId) return
  const map = readMap()
  map[skuId] = stackable
  writeMap(map)
}

export function markStackableFromFlags(
  skuId: string,
  flags: { isStackable?: boolean | null; stackable?: boolean | null },
) {
  if (!skuId) return
  if (typeof flags.isStackable === 'boolean') {
    setStackableSkuId(skuId, flags.isStackable)
    return
  }
  if (typeof flags.stackable === 'boolean') {
    setStackableSkuId(skuId, flags.stackable)
  }
}

/** Front-visible facings for a stackable SKU: columns × stack layers. */
export function suggestedStackableFrontFacings(
  binWidthM: number,
  binHeightM: number,
  skuWidthM: number,
  skuHeightM: number,
): number {
  if (!(binWidthM > 0) || !(binHeightM > 0) || !(skuWidthM > 0) || !(skuHeightM > 0)) return 0
  const cols = Math.max(0, Math.floor(binWidthM / skuWidthM + 1e-6))
  const layers = Math.max(0, Math.floor(binHeightM / skuHeightM + 1e-6))
  return cols * layers
}

/** Non-stackable: at most one vertical layer → columns only. */
export function suggestedNonStackableFrontFacings(
  binWidthM: number,
  skuWidthM: number,
  binHeightM: number,
  skuHeightM: number,
): number {
  if (!(binWidthM > 0) || !(skuWidthM > 0) || !(binHeightM > 0) || !(skuHeightM > 0)) return 0
  if (skuHeightM > binHeightM + 1e-6) return 0
  return Math.max(0, Math.floor(binWidthM / skuWidthM + 1e-6))
}
