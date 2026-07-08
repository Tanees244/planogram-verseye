/** Minimum sane size for 3D box geometry (meters). */
export const MIN_SCENE_DIM = 0.05

/**
 * Coerces a value to a finite positive dimension for rendering / layout math.
 * Treats null, undefined, empty string, NaN, and non-positive numbers as invalid.
 */
export function safeDim(value: unknown, fallback: number, min = MIN_SCENE_DIM): number {
  if (value === null || value === undefined || value === '') return Math.max(min, fallback)
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < min) return Math.max(min, fallback)
  return n
}

export function safePosition(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}
