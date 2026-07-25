/** Prefer user-facing display name; fall back to blueprint / code / id. */
export function displayRackName(rack: {
  displayName?: string | null
  blueprintName?: string | null
  rackName?: string | null
  rackCode?: string | null
  id?: string
}): string {
  const display = (rack.displayName ?? '').trim()
  if (display) return display
  const name = (rack.blueprintName ?? rack.rackName ?? '').trim()
  if (name) return name
  const code = (rack.rackCode ?? '').trim()
  if (code) return code
  return rack.id ?? 'Rack'
}
