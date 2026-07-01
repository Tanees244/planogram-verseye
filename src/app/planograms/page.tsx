'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiLayers, FiSearch, FiBox, FiChevronRight } from 'react-icons/fi'
import { Spinner } from '@/components/Spinner'

interface PlanogramListItem {
  id: string
  name?: string
  storeName?: string
  storeId?: string
  categoryName?: string
  categoryId?: string
  shelfType?: string
  status?: string
  rows?: unknown[]
  rowCount?: number
  images?: unknown[]
}

function asArray(value: any): any[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return value.items ?? value.results ?? value.data ?? []
}

export default function PlanogramsPage() {
  const [items, setItems] = useState<PlanogramListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchPlanograms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ page: '1', pageSize: '50' })
      if (search.trim()) qs.set('search', search.trim())
      const res = await fetch(`/api/catalog/planograms?${qs.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false) {
        setError(json?.message || 'Failed to load planograms')
        setItems([])
        return
      }
      const list = asArray(json?.data).map((p: any) => ({
        id: p.id ?? p.planogramId,
        name: p.name ?? p.title ?? 'Untitled planogram',
        storeName: p.storeName ?? p.store?.name,
        storeId: p.storeId,
        categoryName: p.categoryName ?? p.category?.name,
        categoryId: p.categoryId,
        shelfType: p.shelfType,
        status: p.status,
        rowCount: Array.isArray(p.rows) ? p.rows.length : p.rowCount,
        images: p.images,
      }))
      setItems(list)
    } catch {
      setError('Could not connect to server. Please try again.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchPlanograms()
  }, [fetchPlanograms])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
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
                <FiLayers className="text-[#002952]" />
                Planograms
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Browse all planograms and open one to view its structure.</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search planograms..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002952]/20 focus:border-[#002952] transition-all"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="w-10 h-10 border-4 border-[#002952]/20 border-t-[#002952] rounded-full animate-spin mb-3" />
            <p className="font-medium">Loading planograms...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">
            <p className="font-medium">{error}</p>
            <button
              onClick={fetchPlanograms}
              className="mt-3 px-4 py-2 bg-[#002952] text-white rounded-lg text-sm font-semibold hover:bg-[#001a33] inline-flex items-center gap-2"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl py-20 text-center text-gray-400">
            <FiBox className="mx-auto mb-3 text-4xl opacity-40" />
            <p className="font-medium">No planograms found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/planograms/${p.id}`}
                className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-[#002952]/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {p.storeName || p.storeId || 'No store'}
                      {p.categoryName ? ` · ${p.categoryName}` : ''}
                    </p>
                  </div>
                  <FiChevronRight className="text-gray-300 group-hover:text-[#002952] transition-colors flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {p.status && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#002952]/10 text-[#002952] capitalize">
                      {p.status}
                    </span>
                  )}
                  {p.shelfType && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                      {String(p.shelfType).replace('_', ' ')}
                    </span>
                  )}
                  {typeof p.rowCount === 'number' && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {p.rowCount} row{p.rowCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
