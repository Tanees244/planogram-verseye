'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiBox, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
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
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const selectedType = usePlanogramStore((s) => s.selectedType)

  const [loading, setLoading] = useState(false)
  const [detaching, setDetaching] = useState(false)
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
    return computeShelfCapacity(
      inventory.width,
      occupiedFacingWidthM,
      inventory.sku.quantity,
      used,
    )
  }, [inventory, occupiedFacingWidthM, racks, binId])

  const handleDetach = async () => {
    setDetaching(true)
    const res = await detachBinInventory(binId)
    setDetaching(false)
    if (!res.success) {
      toastApiError(res.message)
      return
    }
    toast.success(res.message ?? 'Bin inventory cleared')
    onInventoryChange?.()
    await load()
  }

  const shell = dark
    ? 'bg-black/70 border-white/10 text-gray-100'
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
            Bin inventory
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
            onClick={() => setSelected(inventory.sku!.skuId, 'product')}
            className={cn(
              'w-full text-left rounded-lg border px-2.5 py-2 transition-colors',
              skuSelected
                ? dark
                  ? 'border-brand/50 bg-brand/15'
                  : 'border-brand/40 bg-brand/5'
                : dark
                  ? 'border-white/10 hover:bg-white/5'
                  : 'border-gray-100 hover:bg-gray-50',
            )}
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
                      {shelfCapacity.placedFacings} / {shelfCapacity.maxTotalFacings} facings
                      {' '}· {shelfCapacity.remainingFacings} more can fit
                      {' '}· {(shelfCapacity.facingWidthM * 100).toFixed(0)} cm each on{' '}
                      {(shelfCapacity.binWidthM * 100).toFixed(0)} cm shelf
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
            Detach inventory
          </button>
        </>
      ) : (
        <div
          className={cn(
            'rounded-lg border px-2.5 py-3 text-[11px] leading-snug',
            dark ? 'border-white/10 text-gray-400' : 'border-gray-100 text-gray-500',
          )}
        >
          <p>Bin is empty.</p>
          {inventory && (
            <p className="mt-1">
              Size {(inventory.width * 100).toFixed(0)}×{(inventory.depth * 100).toFixed(0)}×
              {(inventory.height * 100).toFixed(0)} cm — attach a SKU to see capacity.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
