import { resolveProductFacingId } from '@/utils/storeLayoutLoader'

export type BinSkuHost = {
  id: string
  products: Array<{ id: string; name?: string; quantity?: number }>
}

/** Catalog id of the SKU already in the bin, or null if empty. */
export function occupyingSkuId(bin: BinSkuHost | null | undefined): string | null {
  const first = bin?.products?.[0]
  if (!first) return null
  return resolveProductFacingId(first.id)
}

/** True when the bin already holds a different SKU (one SKU per bin). */
export function binHasForeignSku(
  bin: BinSkuHost | null | undefined,
  skuId: string,
): { blocked: boolean; existingName?: string; existingId?: string } {
  const existingId = occupyingSkuId(bin)
  if (!existingId) return { blocked: false }
  const nextId = resolveProductFacingId(skuId)
  if (existingId === nextId) return { blocked: false, existingId }
  const existingName = bin?.products?.[0]?.name
  return { blocked: true, existingId, existingName }
}
