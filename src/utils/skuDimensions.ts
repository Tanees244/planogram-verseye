import {
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
} from '@/constants/dimensions'
import { safeDim } from '@/utils/safeDimensions'

/**
 * Max realistic single-SKU facing edge in meters.
 * Catalog payloads that exceed this are not meters (cm or mm).
 */
export const MAX_REALISTIC_SKU_DIM_M = 2.5

/**
 * Values at/above this (when already past the meter check) are treated as
 * millimeters — e.g. catalog `width: 100` → 0.10 m (10 cm).
 * Smaller non-meter values (3–50) are treated as centimeters.
 */
const MM_HINT_THRESHOLD = 50

function positiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * Detect catalog unit for a W×H×D triple and return multiplier → meters.
 * - Already meters → 1
 * - Looks like mm (max ≥ 50) → ÷1000
 * - Looks like cm (max > 2.5 and < 50) → ÷100
 */
export function catalogSizeScaleToM(dims: {
  width?: unknown
  height?: unknown
  depth?: unknown
}): number {
  const vals = [dims.width, dims.height, dims.depth]
    .map(positiveNumber)
    .filter((n): n is number => n != null)
  if (vals.length === 0) return 1
  const max = Math.max(...vals)
  if (max <= MAX_REALISTIC_SKU_DIM_M) return 1
  return max >= MM_HINT_THRESHOLD ? 0.001 : 0.01
}

/**
 * Coerce catalog / API W×H×D into meters for the 3D scene.
 * Your catalog list returns e.g. `100, 100, 10` (mm) → `0.10, 0.10, 0.01` m.
 */
export function normalizeCatalogSizeToM(dims: {
  width?: unknown
  height?: unknown
  depth?: unknown
}): { width: number; height: number; depth: number } {
  const scale = catalogSizeScaleToM(dims)
  const w = positiveNumber(dims.width)
  const h = positiveNumber(dims.height)
  const d = positiveNumber(dims.depth)
  return {
    width: safeDim(w != null ? w * scale : NaN, DEFAULT_PRODUCT_WIDTH),
    height: safeDim(h != null ? h * scale : NaN, DEFAULT_PRODUCT_HEIGHT),
    depth: safeDim(d != null ? d * scale : NaN, DEFAULT_PRODUCT_DEPTH),
  }
}

/** Single-axis helper (uses only that value — prefer normalizeCatalogSizeToM). */
export function normalizeCatalogDimToM(value: unknown, fallback: number): number {
  const n = positiveNumber(value)
  if (n == null) return safeDim(fallback, fallback)
  if (n <= MAX_REALISTIC_SKU_DIM_M) return safeDim(n, fallback)
  const scale = n >= MM_HINT_THRESHOLD ? 0.001 : 0.01
  return safeDim(n * scale, fallback)
}

/** True when raw catalog values are not already in meters. */
export function catalogDimsLookLikeCm(dims: {
  width?: unknown
  height?: unknown
  depth?: unknown
}): boolean {
  return catalogSizeScaleToM(dims) !== 1
}

type SkuIdentity = {
  name?: string | null
  code?: string | null
  categoryId?: string | null
}

async function fetchSkuIdentity(
  skuId: string,
  headers: Record<string, string>,
): Promise<SkuIdentity | null> {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(skuId)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) return null
    const s = json?.data ?? json ?? {}
    return {
      name: typeof s.name === 'string' ? s.name : typeof s.skuName === 'string' ? s.skuName : null,
      code: typeof s.code === 'string' ? s.code : typeof s.skuCode === 'string' ? s.skuCode : null,
      categoryId: typeof s.categoryId === 'string' ? s.categoryId : null,
    }
  } catch {
    return null
  }
}

/**
 * Persist meter dims onto the catalog SKU so layout attach validation matches
 * the editor. Catalog PUT requires name/code/categoryId — load them first.
 *
 * Always writes when identity is available: the UI may already show meters
 * (list transform) while the catalog DB still has mm/cm placeholders (100).
 */
export async function ensureSkuDimsOnServer(
  skuId: string,
  dims: { width: number; height: number; depth: number },
  headers: Record<string, string>,
  identity?: SkuIdentity,
): Promise<{ ok: boolean; message?: string; size?: { width: number; height: number; depth: number } }> {
  const size = normalizeCatalogSizeToM(dims)
  if (!(size.width > 0 && size.height > 0 && size.depth > 0)) {
    return { ok: false, message: 'SKU dimensions must be greater than 0' }
  }

  const fromServer = await fetchSkuIdentity(skuId, headers)
  const name = (identity?.name || fromServer?.name || '').trim()
  const code = (identity?.code || fromServer?.code || '').trim()
  const categoryId = (identity?.categoryId || fromServer?.categoryId || '').trim()

  if (!name || !code || !categoryId) {
    return {
      ok: false,
      message:
        'Could not sync SKU size: catalog requires Name, Code, and Category.',
    }
  }

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(skuId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name,
        code,
        categoryId,
        width: size.width,
        height: size.height,
        depth: size.depth,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.isRequestSuccess === false) {
      return {
        ok: false,
        message:
          (typeof data?.message === 'string' && data.message) ||
          `Failed to sync SKU dimensions (${res.status})`,
      }
    }
    return { ok: true, size }
  } catch {
    return { ok: false, message: 'Network error while syncing SKU dimensions' }
  }
}
