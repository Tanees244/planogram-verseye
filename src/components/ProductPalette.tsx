'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FiChevronLeft,
  FiChevronRight,
  FiMove,
  FiPackage,
  FiSearch,
  FiX,
} from 'react-icons/fi'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { usePlanogramStore, type PendingProductParams } from '@/store/planogramStore'
import {
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
} from '@/constants/dimensions'
import { safeDim } from '@/utils/safeDimensions'
import { cn } from '@/lib/cn'
import { Spinner } from '@/components/Spinner'
import { SkuThumb } from '@/components/SkuThumb'

export const PRODUCT_DRAG_MIME = 'application/planogram-sku'

const COLLAPSE_KEY = 'planogram.productPaletteCollapsed'
const shell = 'rounded-xl shadow-lg backdrop-blur-sm bg-black/70 border border-white/10'

interface CatalogSkuRow {
  id: string
  name: string
  code?: string | null
  brandName?: string | null
  categoryName?: string | null
  size?: string | null
  variant?: string | null
  imageUrl?: string | null
  imageStorageKey?: string | null
  modelUrl?: string | null
  modelStorageKey?: string | null
  attachments?: Array<{
    storageKey?: string | null
    url?: string | null
    is3D?: boolean | null
  }> | null
  width?: number | null
  height?: number | null
  depth?: number | null
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

function skuModelStorageKey(sku: CatalogSkuRow): string | null {
  if (sku.modelStorageKey) return sku.modelStorageKey
  const fromAttachment = sku.attachments?.find(
    (a) =>
      a &&
      (a.is3D === true ||
        String(a.storageKey ?? '').toLowerCase().split('?')[0].endsWith('.glb')),
  )?.storageKey
  if (fromAttachment) return fromAttachment
  if (sku.imageStorageKey?.toLowerCase().split('?')[0].endsWith('.glb')) {
    return sku.imageStorageKey
  }
  return null
}

function skuToPending(sku: CatalogSkuRow): PendingProductParams {
  return {
    id: sku.id,
    name: sku.name,
    code: sku.code ?? null,
    brandName: sku.brandName ?? null,
    categoryName: sku.categoryName ?? null,
    size: sku.size ?? null,
    variant: sku.variant ?? null,
    imageUrl: sku.imageUrl ?? null,
    modelUrl: sku.modelUrl ?? null,
    modelStorageKey: skuModelStorageKey(sku),
    width: safeDim(sku.width, DEFAULT_PRODUCT_WIDTH),
    height: safeDim(sku.height, DEFAULT_PRODUCT_HEIGHT),
    depth: safeDim(sku.depth, DEFAULT_PRODUCT_DEPTH),
    color: '#10b981',
  }
}

function metaLine(sku: CatalogSkuRow): string {
  const parts = [sku.brandName, sku.size || sku.variant, sku.code].filter(Boolean)
  return parts.join(' · ') || sku.categoryName || 'Catalog SKU'
}

export function ProductPalette() {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const isPlacingProduct = usePlanogramStore((s) => s.isPlacingProduct)
  const pendingProduct = usePlanogramStore((s) => s.pendingProductParams)
  const startProductPlacement = usePlanogramStore((s) => s.startProductPlacement)
  const cancelProductPlacement = usePlanogramStore((s) => s.cancelProductPlacement)
  const addProductError = usePlanogramStore((s) => s.addProductError)
  const productDropHover = usePlanogramStore((s) => s.productDropHover)
  const setProductDropHover = usePlanogramStore((s) => s.setProductDropHover)
  const selectedType = usePlanogramStore((s) => s.selectedType)
  const setProductPaletteCollapsed = usePlanogramStore((s) => s.setProductPaletteCollapsed)

  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [skus, setSkus] = useState<CatalogSkuRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY) === '1'
      setCollapsed(stored)
      setProductPaletteCollapsed(stored)
    } catch {
      /* ignore */
    }
  }, [setProductPaletteCollapsed])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    setProductPaletteCollapsed(next)
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const fetchSkus = useCallback(async (term: string) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ page: '1', pageSize: '50' })
      if (term.trim()) qs.set('search', term.trim())
      const res = await fetch(`/api/products/list?${qs}`, { headers: authHeaders() })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false) {
        setError(json?.message || 'Failed to load products')
        setSkus([])
        return
      }
      const list = json?.data?.products ?? json?.data ?? []
      setSkus(
        (Array.isArray(list) ? list : []).map((s: any) => ({
          id: s.id ?? s.skuId,
          name: s.name ?? s.skuName ?? 'SKU',
          code: s.code ?? null,
          brandName: s.brandName ?? null,
          categoryName: s.categoryName ?? null,
          size: s.size ?? null,
          variant: s.variant ?? null,
          imageUrl: s.imageUrl ?? null,
          imageStorageKey: s.imageStorageKey ?? null,
          modelUrl: s.modelUrl ?? s.glbUrl ?? s.model3dUrl ?? null,
          modelStorageKey: s.modelStorageKey ?? s.glbStorageKey ?? null,
          attachments: Array.isArray(s.attachments) ? s.attachments : null,
          width: s.width ?? null,
          height: s.height ?? null,
          depth: s.depth ?? null,
        })),
      )
    } catch {
      setError('Could not connect to catalog')
      setSkus([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (collapsed) return
    const t = setTimeout(() => {
      void fetchSkus(search)
    }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search, collapsed, fetchSkus])

  const onDragStart = (sku: CatalogSkuRow, e: React.DragEvent) => {
    if (!selectedStoreId) {
      e.preventDefault()
      return
    }
    const pending = skuToPending(sku)
    e.dataTransfer.setData(PRODUCT_DRAG_MIME, JSON.stringify(pending))
    e.dataTransfer.effectAllowed = 'copy'
    setDraggingId(sku.id)
    startProductPlacement(pending)
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        className={cn(
          shell,
          'relative flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 text-left',
          'hover:bg-black/85 transition-colors group',
        )}
        title="Open product library"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:bg-emerald-500/30 transition-colors">
          <FiPackage size={16} />
        </span>
        <span className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-white leading-tight">Products</span>
          <span className="text-[10px] text-gray-400 leading-tight">
            {skus.length || '…'} SKUs · click to open
          </span>
        </span>
        <FiChevronRight size={16} className="text-gray-400 shrink-0 ml-1 group-hover:text-white transition-colors" />
        {isPlacingProduct && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black/70 animate-pulse" />
        )}
      </button>
    )
  }

  return (
    <div className={cn(shell, 'relative w-full flex-1 min-h-0 flex flex-col overflow-hidden text-gray-100')}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0 bg-black/30">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white shrink-0">
          <FiPackage size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white leading-tight">Product Library</h2>
          <p className="text-[10px] text-gray-400 truncate">Drag or click, then hover a bin to preview</p>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Hide panel"
        >
          <FiChevronLeft size={16} />
        </button>
      </div>

      {!selectedStoreId && (
        <div className="mx-2.5 mt-2.5 px-2.5 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-100 text-[11px] leading-snug">
          Select a store before placing products
        </div>
      )}

      {isPlacingProduct && pendingProduct && (
        <div className="mx-2.5 mt-2.5 px-2.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-[11px]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{pendingProduct.name}</p>
              <p className="text-gray-300 mt-0.5">
                {productDropHover
                  ? productDropHover.fits
                    ? 'Preview on shelf — click or release to attach'
                    : (productDropHover.reason ?? 'Product will not fit in this bin')
                  : 'Hover a bin to preview size on the shelf, then click to place'}
              </p>
              <p className="text-gray-500 mt-1 text-[10px]">
                Facing {(pendingProduct.width * 100).toFixed(0)}×{(pendingProduct.depth * 100).toFixed(0)}×
                {(pendingProduct.height * 100).toFixed(0)} cm
              </p>
            </div>
            <button
              type="button"
              onClick={cancelProductPlacement}
              className="shrink-0 p-1 rounded-md hover:bg-white/10 text-gray-300 hover:text-white"
              title="Cancel placement"
            >
              <FiX size={14} />
            </button>
          </div>
        </div>
      )}

      {(error || addProductError) && (
        <div className="mx-2.5 mt-2 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-200 text-[11px]">
          {error || addProductError}
        </div>
      )}

      <div className="px-2.5 pt-2 shrink-0">
        <div className="relative">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKUs…"
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <Spinner /> Loading catalog…
          </div>
        ) : skus.length === 0 ? (
          <p className="py-8 text-center text-[11px] text-gray-500">No products found.</p>
        ) : (
          skus.map((sku) => {
            const active = pendingProduct?.id === sku.id
            const isDragging = draggingId === sku.id
            return (
              <div
                key={sku.id}
                draggable={Boolean(selectedStoreId)}
                onDragStart={(e) => onDragStart(sku, e)}
                onDragEnd={() => {
                  setDraggingId(null)
                  setProductDropHover(null)
                }}
                onClick={() => {
                  if (!selectedStoreId) return
                  startProductPlacement(skuToPending(sku))
                }}
                className={cn(
                  'flex items-center gap-2.5 p-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all',
                  'border-transparent hover:bg-white/10 hover:border-white/10',
                  active && 'bg-emerald-500/20 border-emerald-500/40',
                  isDragging && 'opacity-50',
                  !selectedStoreId && 'opacity-45 cursor-not-allowed',
                )}
              >
                <SkuThumb
                  sku={sku}
                  className={cn(
                    'w-9 h-9 rounded-lg',
                    active ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-300',
                  )}
                  size={15}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-white truncate">{sku.name}</span>
                    <FiMove size={10} className="text-gray-500 shrink-0 opacity-60" />
                  </div>
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{metaLine(sku)}</p>
                  {(sku.width == null || sku.height == null || sku.depth == null) && (
                    <p className="text-[10px] text-amber-300/90 mt-0.5">
                      No catalog dims — will use defaults on place
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
