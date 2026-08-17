/** Normalized store/branch row from GET /api/locations/list */

export type LocationListItem = {
  id: string
  name: string
  address?: string
  storeType?: string
}

function asArray(value: unknown): unknown[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  const o = value as Record<string, unknown>
  return (o.locations ?? o.items ?? o.results ?? o.data ?? []) as unknown[]
}

/** Parse `{ data: { locations: [...] } }` (and other list envelopes) into store rows. */
export function parseLocationListResponse(json: unknown): LocationListItem[] {
  const root = json as Record<string, unknown> | null | undefined
  const data = root?.data ?? root
  const list = asArray(data)

  return list
    .map((raw): LocationListItem | null => {
      const b = raw as Record<string, unknown>
      const id = String(b.id ?? b.branchId ?? b.storeId ?? '').trim()
      if (!id) return null
      return {
        id,
        name: String(
          b.name ?? b.branchName ?? b.locationCode ?? b.storeName ?? b.code ?? id,
        ),
        address: typeof b.address === 'string' ? b.address : undefined,
        storeType: typeof b.storeType === 'string' ? b.storeType : undefined,
      }
    })
    .filter((x): x is LocationListItem => x !== null)
}
