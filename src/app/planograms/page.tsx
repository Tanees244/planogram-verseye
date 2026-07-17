'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiLayers, FiSearch, FiBox, FiChevronRight, FiTrash2 } from 'react-icons/fi'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { usePlanogramStore } from '@/store/planogramStore'
import { formatPlanogramDateTime, type ShelfListItem } from '@/types/shelf'

function asArray(value: unknown): unknown[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  const o = value as Record<string, unknown>
  return (o.items ?? o.results ?? o.data ?? []) as unknown[]
}

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

function mapShelf(p: Record<string, unknown>): ShelfListItem {
  return {
    id: String(p.id ?? p.shelfId ?? ''),
    storeId: String(p.storeId ?? ''),
    name: String(p.name ?? p.title ?? 'Untitled planogram'),
    sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : undefined,
    categoryId: (p.categoryId as string) ?? null,
    shelfType: (p.shelfType as string | number) ?? null,
    isActive: typeof p.isActive === 'boolean' ? p.isActive : undefined,
    rackSideId: (p.rackSideId as string) ?? null,
    rackId: (p.rackId as string) ?? null,
    rackCode: (p.rackCode as string) ?? null,
    sideCode: (p.sideCode as string) ?? null,
    fixtureType: (p.fixtureType as string) ?? null,
    publishedAt: (p.publishedAt as string) ?? null,
    lastUpdated: (p.lastUpdated as string) ?? (p.updatedAt as string) ?? null,
    hasLayout: typeof p.hasLayout === 'boolean' ? p.hasLayout : undefined,
    hasPlanogram: typeof p.hasPlanogram === 'boolean' ? p.hasPlanogram : undefined,
  }
}

export default function PlanogramsPage() {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)

  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [storeId, setStoreId] = useState(selectedStoreId ?? '')
  const [items, setItems] = useState<ShelfListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (selectedStoreId) setStoreId(selectedStoreId)
  }, [selectedStoreId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/locations/list?page=1&pageSize=100', {
          headers: authHeaders(),
        })
        const json = await res.json().catch(() => ({}))
        const list = asArray(json?.data ?? json).map((s: any) => ({
          id: String(s.id ?? s.branchId ?? ''),
          name: String(s.name ?? s.locationCode ?? s.branchName ?? 'Store'),
        }))
        if (!cancelled) {
          setStores(list.filter((s) => s.id))
          if (!storeId && list[0]?.id) setStoreId(list[0].id)
        }
      } catch {
        /* non-fatal */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchPlanograms = useCallback(async () => {
    if (!storeId) {
      setItems([])
      setLoading(false)
      setError('Select a store to browse planograms.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        storeId,
        page: '1',
        pageSize: '50',
      })
      if (search.trim()) qs.set('search', search.trim())
      const res = await fetch(`/api/layout/shelves?${qs}`, { headers: authHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false || json?.success === false) {
        setError(json?.message || 'Failed to load planograms')
        setItems([])
        return
      }
      const raw = json?.data
      const list = asArray(
        Array.isArray(raw) ? raw : (raw as { items?: unknown[] })?.items ?? raw,
      ).map((p) => mapShelf(p as Record<string, unknown>))
      setItems(list.filter((p) => p.id))
    } catch {
      setError('Could not connect to server. Please try again.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, storeId])

  useEffect(() => {
    void fetchPlanograms()
  }, [fetchPlanograms])

  const removeShelf = async (shelf: ShelfListItem) => {
    setDeletingId(shelf.id)
    try {
      const res = await fetch(`/api/layout/shelves/${encodeURIComponent(shelf.id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false || json?.success === false) {
        window.alert(json?.message || 'Failed to delete planogram')
        return
      }
      setItems((current) => current.filter((item) => item.id !== shelf.id))
    } catch {
      window.alert('Could not connect to server. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const storeLabel =
    stores.find((s) => s.id === storeId)?.name ?? selectedStoreName ?? 'Store'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
              title="Back to builder"
            >
              <FiArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FiLayers className="text-[#2C5282]" />
                Planograms
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Browse planograms for a store — fixture type, publish time, and last update.
              </p>
            </div>
          </div>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2C5282]/20"
          >
            <option value="">Select store…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative max-w-md mb-6">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search planograms…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5282]/20 focus:border-[#2C5282] transition-all"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="w-10 h-10 border-4 border-[#2C5282]/20 border-t-[#2C5282] rounded-full animate-spin mb-3" />
            <p className="font-medium">Loading planograms…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">
            <p className="font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void fetchPlanograms()}
              className="mt-3 px-4 py-2 bg-[#2C5282] text-white rounded-lg text-sm font-semibold hover:bg-[#1A365D] inline-flex items-center gap-2"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center text-gray-400">
            <FiBox className="mx-auto mb-3 text-4xl opacity-40" />
            <p className="font-medium">No planograms found for {storeLabel}.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-semibold">Planogram name</th>
                  <th className="px-4 py-3 font-semibold">Fixture type</th>
                  <th className="px-4 py-3 font-semibold">Published</th>
                  <th className="px-4 py-3 font-semibold">Last updated</th>
                  <th className="px-4 py-3 font-semibold w-20" />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <Link
                        href={`/planograms/${p.id}`}
                        className="font-semibold text-gray-900 hover:text-[#2C5282]"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {p.rackCode ? `Fixture ${p.rackCode}` : storeLabel}
                        {p.sideCode ? ` · ${p.sideCode}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {p.fixtureType ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {p.fixtureType}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatPlanogramDateTime(p.publishedAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatPlanogramDateTime(p.lastUpdated)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void removeShelf(p)}
                          disabled={deletingId === p.id}
                          className="p-1 text-gray-300 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
                          title="Delete planogram"
                          aria-label={`Delete ${p.name}`}
                        >
                          <FiTrash2 />
                        </button>
                        <Link href={`/planograms/${p.id}`} className="text-gray-300 hover:text-[#2C5282]">
                          <FiChevronRight />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
