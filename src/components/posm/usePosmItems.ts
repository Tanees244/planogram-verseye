'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import type { PosmItemListItem } from '@/types/rackBlueprint'

export function usePosmItems(storeId: string | null) {
  const [items, setItems] = useState<PosmItemListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!storeId) {
      setItems([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = { Accept: 'application/json' }
      try {
        const t = getPlanogramTokenFromCookie()
        if (t) headers.Authorization = `Bearer ${t}`
      } catch {
        /* ignore */
      }
      const qs = new URLSearchParams({ storeId, status: 'Active', page: '1', pageSize: '50' })
      const res = await fetch(`/api/company-assets/posm/list?${qs}`, { headers })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false) {
        setError(json?.message || 'Failed to load POSM items')
        setItems([])
        return
      }
      const list = json?.data?.items ?? []
      setItems(
        (Array.isArray(list) ? list : []).filter(
          (p: PosmItemListItem) => p?.id && (p.status ?? 'Active') === 'Active',
        ).map((p: any) => ({
          id: p.id,
          name: p.name,
          posmType: p.posmType,
          status: p.status ?? 'Active',
          conditionStandards: p.conditionStandards ?? null,
          imageUrl: p.imageUrl ?? null,
          imageStorageKey:
            p.imageStorageKey ?? p.imageObjectKey ?? p.storageKey ?? null,
        })),
      )
    } catch {
      setError('Could not load POSM catalog')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  return { items, loading, error, refetch: fetchItems }
}
