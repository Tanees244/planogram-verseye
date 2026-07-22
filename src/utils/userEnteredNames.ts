/**
 * Recent user-entered names for dropdowns (racks, planograms, etc.).
 * Only stores names the user typed themselves — not API code lists.
 */

const PREFIX = 'planogram.userNames.'

export type NameScope = 'rack' | 'planogram' | 'bin' | 'sku'

function key(scope: NameScope) {
  return `${PREFIX}${scope}`
}

export function getUserEnteredNames(scope: NameScope, limit = 25): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key(scope))
    const arr = raw ? (JSON.parse(raw) as string[]) : []
    if (!Array.isArray(arr)) return []
    return arr.filter((n) => typeof n === 'string' && n.trim()).slice(0, limit)
  } catch {
    return []
  }
}

export function rememberUserEnteredName(scope: NameScope, name: string, limit = 25) {
  const cleaned = name.trim()
  if (!cleaned || typeof window === 'undefined') return
  const prev = getUserEnteredNames(scope, limit * 2)
  const next = [cleaned, ...prev.filter((n) => n.toLowerCase() !== cleaned.toLowerCase())].slice(
    0,
    limit,
  )
  try {
    window.localStorage.setItem(key(scope), JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
