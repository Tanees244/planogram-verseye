'use client'

import { useEffect, useState, useCallback, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiLayers, FiPackage, FiBox, FiTrash2, FiUpload } from 'react-icons/fi'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { formatPlanogramDateTime, planogramStatusFromShelf, type ShelfDetail } from '@/types/shelf'
import { PlanogramElevation2D, type ElevationRow } from '@/components/PlanogramThumb'

interface SkuRow {
  skuId?: string
  id?: string
  name?: string
  skuName?: string
  facingCount?: number
  sosPercentTarget?: number
  positionOrder?: number
  imageUrl?: string
  quantity?: number
  position?: { x: number | null; y: number | null } | null
}

interface PlanogramRow {
  rowNumber?: number
  rowLabel?: string | null
  id?: string
  skus?: SkuRow[]
  bins?: Array<{ products?: SkuRow[] }>
}

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

export default function PlanogramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [detail, setDetail] = useState<(ShelfDetail & { description?: string | null; storeName?: string }) | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [uploadingIdeal, setUploadingIdeal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idealFileRef = useRef<HTMLInputElement>(null)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Prefer shelf blueprint (includes product imageUrl + bin-local position).
      const blueprintRes = await fetch(
        `/api/layout/shelves/${encodeURIComponent(id)}/blueprint`,
        { headers: authHeaders() },
      )
      const blueprintJson = await blueprintRes.json().catch(() => ({}))
      if (
        blueprintRes.ok &&
        blueprintJson?.isRequestSuccess !== false &&
        blueprintJson?.success !== false
      ) {
        const d = blueprintJson?.data ?? blueprintJson
        const shelf = d.shelf ?? d
        const side = d.side ?? null
        setDetail({
          id: shelf.id ?? shelf.shelfId ?? id,
          storeId: shelf.storeId,
          name: shelf.name ?? 'Planogram',
          storeName: shelf.storeName,
          description: shelf.description,
          categoryId: shelf.categoryId,
          shelfType: shelf.shelfType,
          fixtureType: shelf.fixtureType ?? d.fixtureType ?? null,
          publishedAt: shelf.publishedAt ?? null,
          lastUpdated: shelf.lastUpdated ?? shelf.updatedAt ?? null,
          rackCode: shelf.rackCode ?? d.rackCode ?? null,
          rackId: shelf.rackId ?? d.rackId ?? null,
          sideCode: shelf.sideCode ?? side?.sideCode ?? null,
          rows: side?.rows ?? shelf.rows ?? d.rows,
          images: shelf.images ?? d.images,
          hasLayout: shelf.hasLayout,
          hasPlanogram: shelf.hasPlanogram,
          hasIdealImage: shelf.hasIdealImage ?? d.hasIdealImage,
          isConfigured: shelf.isConfigured ?? d.isConfigured,
        })
        return
      }

      // Fallback: shelf detail only (catalog planograms API retired).
      const res = await fetch(`/api/layout/shelves/${encodeURIComponent(id)}`, {
        headers: authHeaders(),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false || json?.success === false) {
        setError(
          blueprintJson?.message || json?.message || 'Failed to load planogram',
        )
        return
      }
      const d = json?.data ?? json
      setDetail({
        id: d.id,
        storeId: d.storeId,
        name: d.name ?? 'Planogram',
        storeName: d.storeName,
        description: d.description,
        categoryId: d.categoryId,
        shelfType: d.shelfType,
        fixtureType: d.fixtureType ?? null,
        publishedAt: d.publishedAt ?? null,
        lastUpdated: d.lastUpdated ?? d.updatedAt ?? null,
        rackCode: d.rackCode ?? null,
        rackId: d.rackId ?? null,
        sideCode: d.sideCode ?? null,
        rows: d.rows,
        images: d.images,
        hasLayout: d.hasLayout,
        hasPlanogram: d.hasPlanogram,
        hasIdealImage: d.hasIdealImage,
        isConfigured: d.isConfigured,
      })
    } catch {
      setError('Could not connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  const removeShelf = async () => {
    if (!detail) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/layout/shelves/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false || json?.success === false) {
        window.alert(json?.message || 'Failed to delete planogram')
        return
      }
      router.push('/planograms')
      router.refresh()
    } catch {
      window.alert('Could not connect to server. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const uploadIdealImage = async (file: File) => {
    setUploadingIdeal(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const headers: Record<string, string> = {}
      try {
        const t = getPlanogramTokenFromCookie()
        if (t) headers.Authorization = `Bearer ${t}`
      } catch {
        /* ignore */
      }
      const res = await fetch(
        `/api/layout/shelves/${encodeURIComponent(id)}/planogram/ideal-image`,
        { method: 'PUT', headers, body: form },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false || json?.success === false) {
        window.alert(json?.message || 'Failed to upload ideal image')
        return
      }
      setDetail((prev) =>
        prev
          ? { ...prev, hasIdealImage: true, isConfigured: prev.isConfigured ?? true }
          : prev,
      )
      void fetchDetail()
    } catch {
      window.alert('Could not connect to server. Please try again.')
    } finally {
      setUploadingIdeal(false)
      if (idealFileRef.current) idealFileRef.current.value = ''
    }
  }

  const rows: PlanogramRow[] = detail ? (asArray(detail.rows) as PlanogramRow[]) : []
  const images: Record<string, unknown>[] = detail
    ? (asArray(detail.images) as Record<string, unknown>[])
    : []

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
              <FiLayers className="text-[#2C5282] flex-shrink-0" />
              {detail?.name ?? 'Planogram'}
            </h1>
            {detail?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{detail.description}</p>
            )}
          </div>
          {detail && (
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <input
                ref={idealFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadIdealImage(file)
                }}
              />
              <button
                type="button"
                onClick={() => idealFileRef.current?.click()}
                disabled={uploadingIdeal}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-50"
              >
                <FiUpload />
                {uploadingIdeal ? 'Uploading…' : 'Upload ideal image'}
              </button>
              <button
                type="button"
                onClick={() => void removeShelf()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
              >
                <FiTrash2 />
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="w-10 h-10 border-4 border-[#2C5282]/20 border-t-[#2C5282] rounded-full animate-spin mb-3" />
            <p className="font-medium">Loading planogram…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">
            <p className="font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void fetchDetail()}
              className="mt-3 px-4 py-2 bg-[#2C5282] text-white rounded-lg text-sm font-semibold hover:bg-[#1A365D]"
            >
              Retry
            </button>
          </div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <Meta label="Planogram name" value={detail.name} />
                <Meta label="Fixture type" value={detail.fixtureType ?? undefined} />
                <Meta label="Fixture code" value={detail.rackCode ?? undefined} />
                <Meta label="Published" value={formatPlanogramDateTime(detail.publishedAt)} />
                <Meta label="Last updated" value={formatPlanogramDateTime(detail.lastUpdated)} />
                <Meta label="Store" value={detail.storeName ?? detail.storeId} />
                <Meta label="Rows" value={String(rows.length)} />
                <Meta
                  label="Status"
                  value={planogramStatusFromShelf(detail)}
                />
              </div>
            </div>

            {rows.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4">2D planogram</h2>
                <PlanogramElevation2D
                  rows={rows as ElevationRow[]}
                  title={detail.name}
                  className="aspect-[16/9] max-h-[420px]"
                />
              </div>
            )}

            {images.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4">Reference Images</h2>
                <div className="flex flex-wrap gap-3">
                  {images.map((img, i) => {
                    const src = (img?.url ?? img?.downloadUrl) as string | undefined
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

            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">Structure ({rows.length} rows)</h2>
              {rows.length === 0 ? (
                <p className="text-gray-400 text-sm py-6 text-center">
                  No row structure on this planogram detail response.
                </p>
              ) : (
                <div className="space-y-4">
                  {rows.map((row, idx) => {
                    const directSkus = asArray(row.skus) as SkuRow[]
                    const binProducts = asArray(row.bins).flatMap((bin) =>
                      asArray((bin as { products?: SkuRow[] }).products),
                    ) as SkuRow[]
                    const skus = directSkus.length > 0 ? directSkus : binProducts
                    return (
                      <div key={row.id ?? idx} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                          <FiPackage className="text-[#2C5282]" />
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
                                <th className="px-4 py-2 font-semibold">Bin position</th>
                                <th className="px-4 py-2 font-semibold">SOS % target</th>
                              </tr>
                            </thead>
                            <tbody>
                              {skus.map((sku, j) => (
                                <tr
                                  key={sku.skuId ?? sku.id ?? j}
                                  className="border-b border-gray-50 last:border-0"
                                >
                                  <td className="px-4 py-2 text-gray-800">
                                    <div className="flex items-center gap-2">
                                      {sku.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={sku.imageUrl}
                                          alt=""
                                          className="h-9 w-9 shrink-0 rounded-md border border-gray-200 object-contain bg-white"
                                        />
                                      ) : (
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-gray-300">
                                          <FiBox size={16} />
                                        </span>
                                      )}
                                      <span>{sku.name ?? sku.skuName ?? sku.skuId ?? sku.id}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-gray-600">
                                    {sku.facingCount ?? sku.quantity ?? '—'}
                                  </td>
                                  <td className="px-4 py-2 text-gray-600">
                                    {sku.position &&
                                    (sku.position.x !== null || sku.position.y !== null)
                                      ? `${sku.position.x === null ? 'auto' : `${sku.position.x.toFixed(3)} m`} × ${sku.position.y === null ? 'auto' : `${sku.position.y.toFixed(3)} m`}`
                                      : 'Auto'}
                                  </td>
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

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
      <div className="mt-1 font-semibold truncate text-gray-800">{value || '—'}</div>
    </div>
  )
}
