/**
 * UI length units: centimeters.
 * Store / API / 3D scene stay in meters — convert only at UI boundaries.
 */

export function mToCm(m: number): number {
  if (!Number.isFinite(m)) return 0
  return m * 100
}

export function cmToM(cm: number): number {
  if (!Number.isFinite(cm)) return 0
  return cm / 100
}

/** Round for form display (1 decimal cm). */
export function mToCmDisplay(m: number, digits = 1): number {
  if (!Number.isFinite(m)) return 0
  const f = 10 ** digits
  return Math.round(mToCm(m) * f) / f
}

export function formatCm(m: number | null | undefined, digits = 0): string {
  if (m == null || !Number.isFinite(m)) return '—'
  const cm = mToCm(m)
  return `${digits === 0 ? Math.round(cm) : cm.toFixed(digits)} cm`
}

export function formatCmPair(
  a: number | null | undefined,
  b: number | null | undefined,
  digits = 0,
): string {
  return `${formatCm(a, digits).replace(' cm', '')} × ${formatCm(b, digits)}`
}

export function formatCmTriple(
  w: number | null | undefined,
  d: number | null | undefined,
  h: number | null | undefined,
  digits = 0,
): string {
  const fmt = (v: number | null | undefined) => {
    if (v == null || !Number.isFinite(v)) return '—'
    const cm = mToCm(v)
    return digits === 0 ? String(Math.round(cm)) : cm.toFixed(digits)
  }
  return `${fmt(w)} × ${fmt(d)} × ${fmt(h)} cm`
}

/** Parse a cm form string → meters (NaN if invalid). */
export function parseCmInputToM(raw: string): number {
  const n = parseFloat(String(raw).trim())
  if (!Number.isFinite(n)) return NaN
  return cmToM(n)
}

/** Seed a form field from meters. */
export function cmInputFromM(m: number, digits = 1): string {
  if (!Number.isFinite(m)) return ''
  const cm = mToCmDisplay(m, digits)
  return String(cm)
}
