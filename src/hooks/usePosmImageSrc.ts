'use client'

import { useEffect, useState } from 'react'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { resolvePosmImageUrl } from '@/utils/posmImageUrl'
import { usePlanogramStore } from '@/store/planogramStore'

type PosmFields = {
  id?: string
  imageUrl?: string | null
  imageUrls?: string[] | null
  imageStorageKey?: string | null
}

type CatalogEntry = {
  imageUrl?: string | null
  imageStorageKey?: string | null
}

/** Session cache: POSM id → image fields from catalog list. */
const catalogCache = new Map<string, CatalogEntry>()
let catalogFetch: Promise<void> | null = null

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

async function ensurePosmCatalog(storeId: string): Promise<void> {
  if (catalogFetch) return catalogFetch
  catalogFetch = (async () => {
    try {
      const qs = new URLSearchParams({
        storeId,
        status: 'Active',
        page: '1',
        pageSize: '200',
      })
      const res = await fetch(`/api/company-assets/posm/list?${qs}`, {
        headers: authHeaders(),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      const list = json?.data?.items ?? []
      if (!Array.isArray(list)) return
      for (const p of list) {
        const id = String(p?.id ?? '').trim()
        if (!id) continue
        catalogCache.set(id, {
          imageUrl: p.imageUrl ?? null,
          imageStorageKey:
            p.imageStorageKey ?? p.imageObjectKey ?? p.storageKey ?? null,
        })
      }
    } catch {
      /* non-fatal — leave cache empty */
    } finally {
      // Allow refresh later if needed
      setTimeout(() => {
        catalogFetch = null
      }, 30_000)
    }
  })()
  return catalogFetch
}

/**
 * Resolve a displayable POSM image URL.
 * Always tries the catalog for a storage key (best for WebGL), then falls
 * back to fields on the POSM object (signed URLs).
 */
export function usePosmImageSrc(posm: PosmFields | null | undefined): string | null {
  const storeId = usePlanogramStore((s) => s.selectedStoreId)
  const [fromCatalog, setFromCatalog] = useState<string | null>(() => {
    if (!posm?.id) return null
    const cached = catalogCache.get(posm.id)
    return cached ? resolvePosmImageUrl(cached) : null
  })

  useEffect(() => {
    if (!posm?.id || !storeId) {
      setFromCatalog(null)
      return
    }
    // Prefer catalog storage key even when structure already has signed URLs.
    if (posm.imageStorageKey) {
      setFromCatalog(null)
      return
    }
    const cached = catalogCache.get(posm.id)
    if (cached?.imageStorageKey) {
      setFromCatalog(resolvePosmImageUrl(cached))
      return
    }
    let active = true
    void ensurePosmCatalog(storeId).then(() => {
      if (!active) return
      const entry = catalogCache.get(posm.id!)
      setFromCatalog(entry ? resolvePosmImageUrl(entry) : null)
    })
    return () => {
      active = false
    }
  }, [posm?.id, posm?.imageStorageKey, storeId])

  if (!posm) return null
  // Catalog key first, then fields on the POSM (may be signed-only).
  return fromCatalog ?? resolvePosmImageUrl(posm)
}
