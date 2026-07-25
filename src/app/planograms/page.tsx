'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiLayers, FiSearch, FiBox, FiChevronRight, FiTrash2 } from 'react-icons/fi'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { usePlanogramStore } from '@/store/planogramStore'
import { formatPlanogramDateTime, type ShelfListItem } from '@/types/shelf'
import { PlanogramThumb } from '@/components/PlanogramThumb'
import { getUserEnteredNames, rememberUserEnteredName } from '@/utils/userEnteredNames'

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
    hasIdealImage:
      typeof p.hasIdealImage === 'boolean'
        ? p.hasIdealImage
        : typeof p.has_ideal_image === 'boolean'
          ? p.has_ideal_image
          : undefined,
    isConfigured:
      typeof p.isConfigured === 'boolean'
        ? p.isConfigured
        : typeof p.is_configured === 'boolean'
          ? p.is_configured
          : undefined,
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
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])

  useEffect(() => {
    setNameSuggestions(getUserEnteredNames('planogram'))
  }, [items.length])

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
                Browse by planogram name — 2D shelf sketches, fixture type, and last update.
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
            list="planogram-name-suggestions"
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => {
              if (search.trim()) {
                rememberUserEnteredName('planogram', search.trim())
                setNameSuggestions(getUserEnteredNames('planogram'))
              }
            }}
            placeholder="Search by planogram name…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2C5282]/20 focus:border-[#2C5282] transition-all"
          />
          <datalist id="planogram-name-suggestions">
            {nameSuggestions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => (
              <div
                key={p.id}
                className="group rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:shadow-md hover:border-[#2C5282]/25 transition-all"
              >
                <Link
                  href={`/planograms/${p.id}`}
                  className="block"
                  onClick={() => rememberUserEnteredName('planogram', p.name)}
                >
                  <PlanogramThumb item={p} className="aspect-[16/10]" />
                </Link>
                <div className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/planograms/${p.id}`}
                        onClick={() => rememberUserEnteredName('planogram', p.name)}
                        className="font-semibold text-gray-900 hover:text-[#2C5282] line-clamp-2"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {[storeLabel, p.rackCode ? `Code ${p.rackCode}` : null, p.sideCode]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === p.id}
                      onClick={() => void removeShelf(p)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0 disabled:opacity-50"
                      title="Delete planogram"
                      aria-label={`Delete ${p.name}`}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {p.fixtureType ? (
                        <span className="px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
                          {p.fixtureType.replace(/_/g, ' ')}
                        </span>
                      ) : null}
                      {p.isConfigured === true ? (
                        <span className="px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
                          Configured
                        </span>
                      ) : p.hasIdealImage === false || p.isConfigured === false ? (
                        <span className="px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-800">
                          Needs ideal image
                        </span>
                      ) : null}
                      {!p.fixtureType && p.isConfigured == null && p.hasIdealImage == null
                        ? '—'
                        : null}
                    </span>
                    <span className="truncate">{formatPlanogramDateTime(p.lastUpdated)}</span>
                  </div>
                  <Link
                    href={`/planograms/${p.id}`}
                    onClick={() => rememberUserEnteredName('planogram', p.name)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#2C5282] hover:underline"
                  >
                    Open <FiChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
