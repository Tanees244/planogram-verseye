'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { FiArrowLeft, FiLayers, FiPackage, FiBox } from 'react-icons/fi'

interface SkuRow {
  skuId?: string
  id?: string
  name?: string
  skuName?: string
  facingCount?: number
  sosPercentTarget?: number
  positionOrder?: number
  imageUrl?: string
}

interface PlanogramRow {
  rowNumber?: number
  rowLabel?: string | null
  id?: string
  skus?: SkuRow[]
  bins?: any[]
}

interface PlanogramDetail {
  id?: string
  name?: string
  description?: string | null
  storeId?: string
  storeName?: string
  categoryId?: string
  categoryName?: string
  shelfId?: string
  shelfName?: string
  shelfType?: string
  status?: string
  images?: any[]
  rows?: PlanogramRow[]
}

function asArray(value: any): any[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return value.items ?? value.results ?? value.data ?? []
}

export default function PlanogramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [detail, setDetail] = useState<PlanogramDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/catalog/planograms/${encodeURIComponent(id)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false) {
        setError(json?.message || 'Failed to load planogram')
        return
      }
      setDetail(json?.data ?? json)
    } catch {
      setError('Could not connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const rows: PlanogramRow[] = detail ? asArray(detail.rows) : []
  const images: any[] = detail ? asArray(detail.images) : []

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/planograms"
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
            title="Back to planograms"
          >
            <FiArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 truncate">
              <FiLayers className="text-[#002952] flex-shrink-0" />
              {detail?.name ?? 'Planogram'}
            </h1>
            {detail?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{detail.description}</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="w-10 h-10 border-4 border-[#002952]/20 border-t-[#002952] rounded-full animate-spin mb-3" />
            <p className="font-medium">Loading planogram...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">
            <p className="font-medium">{error}</p>
            <button
              onClick={fetchDetail}
              className="mt-3 px-4 py-2 bg-[#002952] text-white rounded-lg text-sm font-semibold hover:bg-[#001a33]"
            >
              Retry
            </button>
          </div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Meta */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Meta label="Store" value={detail.storeName ?? detail.storeId} />
                <Meta label="Category" value={detail.categoryName ?? detail.categoryId} />
                <Meta label="Shelf" value={detail.shelfName ?? detail.shelfId} />
                <Meta
                  label="Shelf type"
                  value={detail.shelfType ? String(detail.shelfType).replace('_', ' ') : undefined}
                />
                <Meta label="Status" value={detail.status} highlight />
                <Meta label="Rows" value={String(rows.length)} />
              </div>
            </div>

            {/* Reference images */}
            {images.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4">Reference Images</h2>
                <div className="flex flex-wrap gap-3">
                  {images.map((img, i) => {
                    const src = img?.url ?? img?.downloadUrl
                    return src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={`Reference ${i + 1}`}
                        className="w-32 h-32 object-cover rounded-xl border border-gray-200"
                      />
                    ) : (
                      <div
                        key={i}
                        className="w-32 h-32 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-300"
                      >
                        <FiBox size={28} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Rows → SKUs */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">Structure ({rows.length} rows)</h2>
              {rows.length === 0 ? (
                <p className="text-gray-400 text-sm py-6 text-center">No rows in this planogram.</p>
              ) : (
                <div className="space-y-4">
                  {rows.map((row, idx) => {
                    const skus = asArray(row.skus)
                    return (
                      <div key={row.id ?? idx} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                          <FiPackage className="text-[#002952]" />
                          <span className="font-semibold text-gray-800 text-sm">
                            Row {row.rowNumber ?? idx + 1}
                            {row.rowLabel ? ` · ${row.rowLabel}` : ''}
                          </span>
                          <span className="ml-auto text-xs text-gray-500">
                            {skus.length} SKU{skus.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {skus.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                                <th className="px-4 py-2 font-semibold">SKU</th>
                                <th className="px-4 py-2 font-semibold">Facings</th>
                                <th className="px-4 py-2 font-semibold">SOS % target</th>
                              </tr>
                            </thead>
                            <tbody>
                              {skus.map((sku, j) => (
                                <tr key={sku.skuId ?? sku.id ?? j} className="border-b border-gray-50 last:border-0">
                                  <td className="px-4 py-2 text-gray-800">
                                    <div className="flex items-center gap-2">
                                      {sku.imageUrl && (
                                        <img
                                          src={sku.imageUrl}
                                          alt={sku.name ?? sku.skuName ?? 'SKU'}
                                          className="w-8 h-8 rounded object-cover border border-gray-200 bg-white"
                                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                        />
                                      )}
                                      <span>{sku.name ?? sku.skuName ?? sku.skuId ?? sku.id}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-gray-600">{sku.facingCount ?? '—'}</td>
                                  <td className="px-4 py-2 text-gray-600">
                                    {sku.sosPercentTarget != null ? `${sku.sosPercentTarget}%` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="px-4 py-3 text-gray-400 text-xs">No SKUs in this row.</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Meta({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
      <div
        className={`mt-1 font-semibold truncate ${
          highlight ? 'text-[#002952] capitalize' : 'text-gray-800'
        }`}
      >
        {value || '—'}
      </div>
    </div>
  )
}
