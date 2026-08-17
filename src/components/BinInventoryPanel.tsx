'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiBox, FiRefreshCw, FiTrash2, FiMove, FiCopy, FiClipboard, FiMinus, FiPlus, FiEdit2, FiMaximize2 } from 'react-icons/fi'
import { cn } from '@/lib/cn'
import { Spinner } from '@/components/Spinner'
import {
  computeShelfCapacity,
  fetchBinInventory,
  resolveOccupiedFacingWidthM,
  usedShelfWidthM,
  type BinInventoryData,
} from '@/utils/binInventoryApi'
import { toastApiError } from '@/utils/apiMessages'
import toast from 'react-hot-toast'
import { usePlanogramStore } from '@/store/planogramStore'
import { resolveProductFacingId } from '@/utils/storeLayoutLoader'
import { PRODUCT_MOVE_MIME } from '@/components/ProductPalette'

interface BinInventoryPanelProps {
  binId: string
  dark?: boolean
  refreshKey?: number
  onInventoryChange?: () => void
  className?: string
}

export function BinInventoryPanel({
  binId,
  dark = true,
  refreshKey = 0,
  onInventoryChange,
  className,
}: BinInventoryPanelProps) {
  const racks = usePlanogramStore((s) => s.area.racks)
  const setSelected = usePlanogramStore((s) => s.setSelected)
  const detachBinInventory = usePlanogramStore((s) => s.detachBinInventory)
  const startMovingBinInventory = usePlanogramStore((s) => s.startMovingBinInventory)
  const cancelMovingBinInventory = usePlanogramStore((s) => s.cancelMovingBinInventory)
  const adjustBinSkuQuantity = usePlanogramStore((s) => s.adjustBinSkuQuantity)
  const fillSkuAcrossRemainingRow = usePlanogramStore((s) => s.fillSkuAcrossRemainingRow)
  const updateBinOnServer = usePlanogramStore((s) => s.updateBinOnServer)
  const movingInventoryFromBinId = usePlanogramStore((s) => s.movingInventoryFromBinId)
  const copySelection = usePlanogramStore((s) => s.copySelection)
  const pasteClipboard = usePlanogramStore((s) => s.pasteClipboard)
  const clipboard = usePlanogramStore((s) => s.clipboard)
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const selectedType = usePlanogramStore((s) => s.selectedType)

  const [loading, setLoading] = useState(false)
  const [detaching, setDetaching] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [filling, setFilling] = useState(false)
  const [savingSize, setSavingSize] = useState(false)
  const [widthCm, setWidthCm] = useState('')
  const [depthCm, setDepthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [inventory, setInventory] = useState<BinInventoryData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchBinInventory(binId)
    setLoading(false)
    if (!res.success) {
      setError(res.message ?? 'Failed to load inventory')
      setInventory(null)
      return
    }
    setInventory(res.data ?? null)
  }, [binId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const localBin = useMemo(() => {
    for (const rack of racks) {
      for (const side of rack.sides) {
        for (const row of side.rows) {
          const b = row.bins.find((x) => x.id === binId)
          if (b) return { bin: b, row, rack }
        }
      }
    }
    return null
  }, [racks, binId])

  useEffect(() => {
    const w = inventory?.width ?? localBin?.bin.width ?? 0
    const d = inventory?.depth ?? localBin?.bin.depth ?? 0
    const h = inventory?.height ?? localBin?.bin.height ?? 0
    if (w > 0) setWidthCm(String(Math.round(w * 100)))
    if (d > 0) setDepthCm(String(Math.round(d * 100)))
    if (h > 0) setHeightCm(String(Math.round(h * 100)))
  }, [binId, inventory?.width, inventory?.depth, inventory?.height, localBin?.bin.width, localBin?.bin.depth, localBin?.bin.height])

  const handleResizeBin = async () => {
    const width = Number(widthCm) / 100
    const depth = Number(depthCm) / 100
    const height = Number(heightCm) / 100
    if (!(width > 0 && depth > 0 && height > 0)) {
      toast.error('Enter width, depth, and height in cm')
      return
    }
    setSavingSize(true)
    const res = await updateBinOnServer(binId, { width, depth, height })
    setSavingSize(false)
    if (!res.success) {
      toastApiError(res.message)
      return
    }
    toast.success(res.message ?? 'Shelf space updated')
    onInventoryChange?.()
    await load()
  }

  const occupiedFacingWidthM = useMemo(
    () => resolveOccupiedFacingWidthM(inventory, racks, binId),
    [inventory, racks, binId],
  )

  const shelfCapacity = useMemo(() => {
    if (!inventory?.sku || !(inventory.width > 0) || !(occupiedFacingWidthM && occupiedFacingWidthM > 0)) {
      return null
    }
    const used = usedShelfWidthM(inventory, {
      facingWidthM: occupiedFacingWidthM,
      racks,
      binId,
    })
    const localBin = racks
      ? (() => {
          for (const rack of racks) {
            for (const side of rack.sides) {
              for (const row of side.rows) {
                const b = row.bins.find((x) => x.id === binId)
                if (b) return b
              }
            }
          }
          return null
        })()
      : null
    const localProduct = localBin?.products.find((p) => {
      const pid = resolveProductFacingId(p.id)
      return pid === inventory.sku!.skuId || p.id === inventory.sku!.skuId
    })
    const facingDepthM =
      localProduct && Number(localProduct.depth) > 0
        ? Number(localProduct.depth)
        : occupiedFacingWidthM
    const facingHeightM =
      localProduct && Number(localProduct.height) > 0
        ? Number(localProduct.height)
        : occupiedFacingWidthM
    return computeShelfCapacity(
      inventory.width,
      occupiedFacingWidthM,
      inventory.sku.quantity,
      used,
      {
        binDepthM: inventory.depth > 0 ? inventory.depth : undefined,
        facingDepthM,
        binHeightM: inventory.height > 0 ? inventory.height : undefined,
        facingHeightM,
      },
    )
  }, [inventory, occupiedFacingWidthM, racks, binId])

  const handleAdjustQty = async (delta: number) => {
    setAdjusting(true)
    const res = await adjustBinSkuQuantity(binId, delta)
    setAdjusting(false)
    if (!res.success) {
      toastApiError(res.message)
      return
    }
    toast.success(res.quantity != null ? `${res.quantity} units` : 'Quantity updated')
    onInventoryChange?.()
    await load()
  }

  const handleFillRemaining = async () => {
    setFilling(true)
    const res = await fillSkuAcrossRemainingRow(binId)
    setFilling(false)
    if (!res.success) {
      toastApiError(res.message)
      return
    }
    toast.success(res.message ?? 'Filled remaining shelf')
    onInventoryChange?.()
    await load()
  }

  const handleDetach = async () => {
    setDetaching(true)
    const res = await detachBinInventory(binId, { removeBin: true })
    setDetaching(false)
    if (!res.success) {
      toastApiError(res.message)
      return
    }
    toast.success(res.message ?? 'SKU and shelf slot removed')
    onInventoryChange?.()
  }

  const shell = dark
    ? 'bg-[#111827] border-slate-600 text-gray-100'
    : 'bg-white border-gray-200 text-gray-800'

  const occupied = Boolean(inventory?.sku)
  const usagePct = shelfCapacity?.usagePct ?? 0
  const usageLabel =
    shelfCapacity != null
      ? `${shelfCapacity.usagePct.toFixed(1)}% shelf used`
      : ''

  const skuSelected =
    occupied &&
    selectedType === 'product' &&
    selectedId &&
    inventory?.sku &&
    resolveProductFacingId(selectedId) === inventory.sku.skuId

  return (
    <div className={cn('w-full rounded-xl border p-2.5 space-y-2', shell, className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide',
              dark ? 'text-gray-400' : 'text-gray-500',
            )}
          >
            Shelf inventory
          </p>
          {inventory?.binName && (
            <p className={cn('text-xs font-medium truncate', dark ? 'text-white' : 'text-gray-900')}>
              {inventory.binName}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={cn(
            'p-1.5 rounded-lg transition-colors shrink-0',
            dark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-100 text-gray-500',
          )}
          title="Refresh inventory"
        >
          <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !inventory ? (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-400">
          <Spinner /> Loading…
        </div>
      ) : error ? (
        <p className="text-[11px] text-red-300 leading-snug">{error}</p>
      ) : occupied && inventory?.sku ? (
        <>
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              const payload = JSON.stringify({
                mode: 'move',
                sourceBinId: binId,
              })
              e.dataTransfer.setData(PRODUCT_MOVE_MIME, payload)
              e.dataTransfer.effectAllowed = 'move'
              startMovingBinInventory(binId)
            }}
            onDragEnd={() => {
              // Drop handler clears move mode; keep if user aborted without drop on bin
              if (usePlanogramStore.getState().movingInventoryFromBinId === binId) {
                cancelMovingBinInventory()
              }
            }}
            onClick={() => setSelected(inventory.sku!.skuId, 'product')}
            className={cn(
              'w-full text-left rounded-lg border px-2.5 py-2 transition-colors cursor-grab active:cursor-grabbing',
              skuSelected
                ? dark
                  ? 'border-brand/50 bg-brand/15'
                  : 'border-brand/40 bg-brand/5'
                : dark
                  ? 'border-white/10 hover:bg-white/5'
                  : 'border-gray-100 hover:bg-gray-50',
            )}
            title="Drag onto another shelf slot in the 3D scene to move this SKU"
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
                  dark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700',
                )}
              >
                <FiBox size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-semibold truncate', dark ? 'text-white' : 'text-gray-900')}>
                  {inventory.sku.skuName}
                </p>
                <p className={cn('text-[11px] mt-0.5 leading-snug', dark ? 'text-gray-400' : 'text-gray-500')}>
                  {shelfCapacity ? (
                    <>
                      {shelfCapacity.placedFacings} / {shelfCapacity.maxTotalFacings} units (W×D×H)
                      {' '}· front face uses linear facings for save
                      {' '}· {shelfCapacity.remainingFacings} more can fit
                      {shelfCapacity.cols != null && shelfCapacity.depthRows != null
                        ? ` · ${shelfCapacity.cols}×${shelfCapacity.depthRows}${
                            shelfCapacity.stackLayers != null && shelfCapacity.stackLayers > 1
                              ? `×${shelfCapacity.stackLayers}`
                              : ''
                          } grid`
                        : ''}
                      {' '}· {(shelfCapacity.facingWidthM * 100).toFixed(0)} cm facing on{' '}
                      {(shelfCapacity.binWidthM * 100).toFixed(0)}
                      {shelfCapacity.binDepthM
                        ? `×${(shelfCapacity.binDepthM * 100).toFixed(0)}`
                        : ''}{' '}
                      cm shelf
                    </>
                  ) : (
                    <>
                      {inventory.sku.quantity} facing{inventory.sku.quantity === 1 ? '' : 's'} placed
                      {' '}· dimensions loading…
                    </>
                  )}
                  {usageLabel ? ` · ${usageLabel}` : ''}
                </p>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all min-w-[2px]"
                style={{ width: `${Math.max(usagePct, inventory.sku.quantity > 0 ? 0.5 : 0)}%` }}
              />
            </div>
          </button>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1.5">
            <span className={cn('text-[11px] font-medium', dark ? 'text-gray-300' : 'text-gray-600')}>
              Units
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={adjusting || inventory.sku.quantity <= 1}
                onClick={() => void handleAdjustQty(-1)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition-colors disabled:opacity-40',
                  dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
                )}
                title="Remove one unit"
              >
                <FiMinus size={14} />
              </button>
              <span className={cn('min-w-[2ch] text-center text-sm font-semibold tabular-nums', dark ? 'text-white' : 'text-gray-900')}>
                {inventory.sku.quantity}
              </span>
              <button
                type="button"
                disabled={adjusting}
                onClick={() => void handleAdjustQty(1)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold transition-colors disabled:opacity-40',
                  dark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
                )}
                title="Add one unit"
              >
                <FiPlus size={14} />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleFillRemaining()}
            disabled={filling || adjusting || savingSize}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50',
              dark
                ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
            )}
            title="Expand this slot across free width, depth, and height, then fill units"
          >
            {filling ? <Spinner /> : <FiMaximize2 size={12} />}
            Fill remaining shelf
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setSelected(binId, 'bin')
                const res = copySelection()
                if (res.success) toast.success(res.message ?? 'Copied')
                else toast.error(res.message ?? 'Copy failed')
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
                dark
                  ? 'border border-white/15 text-gray-200 hover:bg-white/10'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
              )}
              title="Ctrl+C"
            >
              <FiCopy size={12} />
              Copy SKU
            </button>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  setSelected(binId, 'bin')
                  const res = await pasteClipboard()
                  if (res.success) {
                    toast.success(res.message ?? 'Pasted')
                    onInventoryChange?.()
                    await load()
                  } else toast.error(res.message ?? 'Paste failed')
                })()
              }}
              disabled={!clipboard}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
                dark
                  ? 'border border-white/15 text-gray-200 hover:bg-white/10 disabled:opacity-40'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40',
              )}
              title="Ctrl+V — paste copied SKU content onto this shelf"
            >
              <FiClipboard size={12} />
              {clipboard?.kind === 'row' ? 'Paste SKUs' : 'Paste SKU'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (movingInventoryFromBinId === binId) {
                cancelMovingBinInventory()
                toast('Move cancelled')
                return
              }
              startMovingBinInventory(binId)
              toast('Click another SKU or shelf in the scene to move this product')
            }}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
              movingInventoryFromBinId === binId
                ? dark
                  ? 'border border-amber-500/40 bg-amber-500/15 text-amber-200'
                  : 'border border-amber-300 bg-amber-50 text-amber-800'
                : dark
                  ? 'border border-white/15 text-gray-200 hover:bg-white/10'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
            )}
          >
            <FiMove size={12} />
            {movingInventoryFromBinId === binId ? 'Cancel move' : 'Move to another shelf'}
          </button>
          <button
            type="button"
            onClick={() => void handleDetach()}
            disabled={detaching}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
              dark
                ? 'border border-red-500/30 text-red-300 hover:bg-red-500/10'
                : 'border border-red-200 text-red-600 hover:bg-red-50',
              detaching && 'opacity-60',
            )}
          >
            {detaching ? <Spinner /> : <FiTrash2 size={12} />}
            Remove SKU & slot
          </button>
        </>
      ) : (
        <div
          className={cn(
            'rounded-lg border px-2.5 py-3 text-[11px] leading-snug space-y-2',
            dark ? 'border-white/10 text-gray-400' : 'border-gray-100 text-gray-500',
          )}
        >
          <p>No products on this shelf slot.</p>
          {inventory && (
            <p>
              Size {(inventory.width * 100).toFixed(0)}×{(inventory.depth * 100).toFixed(0)}×
              {(inventory.height * 100).toFixed(0)} cm — attach a SKU to see capacity.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              void (async () => {
                setSelected(binId, 'bin')
                const res = await pasteClipboard()
                if (res.success) {
                  toast.success(res.message ?? 'Pasted')
                  onInventoryChange?.()
                  await load()
                } else toast.error(res.message ?? 'Paste failed')
              })()
            }}
            disabled={!clipboard}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors',
              dark
                ? 'border border-white/15 text-gray-200 hover:bg-white/10 disabled:opacity-40'
                : 'border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40',
            )}
            title="Ctrl+V — paste copied SKU content onto this shelf"
          >
            <FiClipboard size={12} />
            {clipboard?.kind === 'row' ? 'Paste SKUs' : 'Paste SKU'}
          </button>
        </div>
      )}

      <div
        className={cn(
          'rounded-lg border px-2.5 py-2 space-y-2',
          dark ? 'border-white/10' : 'border-gray-100',
        )}
      >
        <p
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5',
            dark ? 'text-gray-400' : 'text-gray-500',
          )}
        >
          <FiEdit2 size={11} />
          Resize shelf space
        </p>
        <p className={cn('text-[10px] leading-snug', dark ? 'text-gray-500' : 'text-gray-400')}>
          Expand across free shelf width (not one end), plus depth and height, then Fill remaining shelf.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['W', widthCm, setWidthCm],
              ['D', depthCm, setDepthCm],
              ['H', heightCm, setHeightCm],
            ] as const
          ).map(([label, value, setValue]) => (
            <label key={label} className="min-w-0">
              <span className={cn('text-[10px] font-medium', dark ? 'text-gray-400' : 'text-gray-500')}>
                {label} cm
              </span>
              <input
                type="number"
                min={5}
                step={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={cn(
                  'mt-0.5 w-full rounded-md border px-1.5 py-1 text-xs tabular-nums',
                  dark
                    ? 'border-white/15 bg-white/5 text-white'
                    : 'border-gray-200 bg-white text-gray-900',
                )}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleResizeBin()}
          disabled={savingSize}
          className={cn(
            'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50',
            dark
              ? 'bg-white/10 text-white hover:bg-white/15'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
          )}
        >
          {savingSize ? <Spinner /> : <FiEdit2 size={12} />}
          Save size
        </button>
      </div>
    </div>
  )
}
