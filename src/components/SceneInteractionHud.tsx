'use client'

import { useEffect, useState } from 'react'
import { FiCrosshair, FiMove, FiPackage, FiBox, FiLayers, FiHome } from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import { cn } from '@/lib/cn'
import { PANEL_SHELL } from '@/lib/uiShell'

type HudTone = 'idle' | 'place' | 'product' | 'move' | 'roof' | 'drop'

function toneClasses(tone: HudTone) {
  switch (tone) {
    case 'place':
      return 'border-sky-400/40 bg-[#0f1a2e] text-sky-100'
    case 'product':
      return 'border-emerald-400/40 bg-[#0f1f1a] text-emerald-100'
    case 'move':
      return 'border-amber-400/40 bg-[#1f180f] text-amber-100'
    case 'roof':
      return 'border-brand/45 bg-[#152033] text-brand-light'
    case 'drop':
      return 'border-violet-400/40 bg-[#16122a] text-violet-100'
    default:
      return 'border-slate-600 bg-[#111827] text-gray-200'
  }
}

/** Bottom-center contextual coach for the 3D store editor. */
export function SceneInteractionHud({ className }: { className?: string }) {
  const isPlacingRack = usePlanogramStore((s) => s.isPlacingRack)
  const placingFixtureType = usePlanogramStore((s) => s.placingFixtureType)
  const isPlacingProduct = usePlanogramStore((s) => s.isPlacingProduct)
  const isAttachingProduct = usePlanogramStore((s) => s.isAttachingProduct)
  const isLoadingStoreLayout = usePlanogramStore((s) => s.isLoadingStoreLayout)
  const pendingProduct = usePlanogramStore((s) => s.pendingProductParams)
  const productDropHover = usePlanogramStore((s) => s.productDropHover)
  const movingInventoryFromBinId = usePlanogramStore((s) => s.movingInventoryFromBinId)
  const fixtureDragActive = usePlanogramStore((s) => s.fixtureDragActive)
  const editingRackId = usePlanogramStore((s) => s.editingRackId)
  const setEditingRackId = usePlanogramStore((s) => s.setEditingRackId)
  const roofVisible = usePlanogramStore((s) => s.roofVisible)
  const selectedType = usePlanogramStore((s) => s.selectedType)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const productPlacementDraft = usePlanogramStore((s) => s.productPlacementDraft)
  const cancelFixturePlacement = usePlanogramStore((s) => s.cancelFixturePlacement)
  const cancelProductPlacement = usePlanogramStore((s) => s.cancelProductPlacement)
  const cancelMovingBinInventory = usePlanogramStore((s) => s.cancelMovingBinInventory)
  const setRoofVisible = usePlanogramStore((s) => s.setRoofVisible)

  const [visible, setVisible] = useState(true)
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    setPulse((n) => n + 1)
  }, [
    isPlacingRack,
    isPlacingProduct,
    isAttachingProduct,
    isLoadingStoreLayout,
    movingInventoryFromBinId,
    productDropHover?.binId,
    productDropHover?.rowId,
    productPlacementDraft?.rowId,
    fixtureDragActive,
    editingRackId,
    roofVisible,
    selectedType,
  ])

  let tone: HudTone = 'idle'
  let icon = <FiCrosshair size={15} className="shrink-0" />
  let title = 'Store editor'
  let detail = 'Orbit · right-drag pan · scroll zoom · click racks, shelves, or products'
  let action: { label: string; onClick: () => void } | null = null

  if (!selectedStoreId) {
    tone = 'idle'
    title = 'Select a store'
    detail = 'Choose a store to load racks and start editing the layout'
  } else if (roofVisible) {
    tone = 'roof'
    icon = <FiHome size={15} className="shrink-0" />
    title = 'Roof is closed'
    detail = 'Click the roof in 3D — or Open Building — to enter and edit fixtures'
    action = { label: 'Open building', onClick: () => setRoofVisible(false) }
  } else if (movingInventoryFromBinId) {
    tone = 'move'
    icon = <FiMove size={15} className="shrink-0" />
    title = 'Moving SKU'
    detail = 'Click or drop onto another shelf · Esc cancels'
    action = { label: 'Cancel', onClick: () => cancelMovingBinInventory() }
  } else if (isAttachingProduct) {
    tone = 'product'
    icon = <FiPackage size={15} className="shrink-0" />
    title = 'Attaching product…'
    detail = 'Creating shelf slot and saving inventory'
  } else if (isLoadingStoreLayout) {
    tone = 'place'
    icon = <FiLayers size={15} className="shrink-0" />
    title = 'Loading store racks…'
    detail = 'Fetching fixtures, shelves, and products'
  } else if (productPlacementDraft && pendingProduct) {
    tone = 'drop'
    icon = <FiPackage size={15} className="shrink-0" />
    title = pendingProduct.name
      ? `Adjust ${pendingProduct.name}`
      : 'Adjust placement'
    detail = productPlacementDraft.previewFits
      ? `Front ${productPlacementDraft.facings} · depth ${productPlacementDraft.depth} · stack ${productPlacementDraft.stack} — confirm in the panel`
      : productPlacementDraft.reason || 'Does not fit — change facings, depth, or stack'
    action = { label: 'Cancel', onClick: () => cancelProductPlacement() }
  } else if (isPlacingProduct || pendingProduct) {
    tone = productDropHover ? 'drop' : 'product'
    icon = <FiPackage size={15} className="shrink-0" />
    title = pendingProduct?.name ? `Placing ${pendingProduct.name}` : 'Placing product'
    detail =
      selectedType === 'rack'
        ? 'Click a shelf on this rack · Esc cancels'
        : productDropHover
          ? productDropHover.fits
            ? 'Looks good — click or drop on the shelf to set facings'
            : productDropHover.reason || 'This shelf cannot fit the product'
          : 'Click or drop onto a shelf (row) to preview facings · Esc cancels'
    action = { label: 'Cancel', onClick: () => cancelProductPlacement() }
  } else if (editingRackId) {
    tone = 'move'
    icon = <FiMove size={15} className="shrink-0" />
    title = 'Moving rack'
    detail = 'Click an empty floor cell to place · cannot overlap other racks · Esc cancels'
    action = { label: 'Cancel', onClick: () => setEditingRackId(null) }
  } else if (isPlacingRack || fixtureDragActive) {
    tone = 'place'
    icon = <FiBox size={15} className="shrink-0" />
    title = placingFixtureType
      ? `Placing ${placingFixtureType.replace(/_/g, ' ').toLowerCase()}`
      : 'Placing fixture'
    detail = 'Move on the floor grid · click empty space to drop · cannot overlap · Esc cancels'
    action = { label: 'Cancel', onClick: () => cancelFixturePlacement() }
  } else if (selectedType === 'rack') {
    tone = 'idle'
    icon = <FiLayers size={15} className="shrink-0" />
    title = 'Rack selected'
    detail = 'Use the left panel for rows, POSM, export, publish · Move Rack to reposition'
  } else if (selectedType === 'row') {
    tone = 'idle'
    icon = <FiLayers size={15} className="shrink-0" />
    title = 'Row selected'
    detail = 'Place SKUs from the product library onto this shelf'
  } else if (selectedType === 'bin') {
    tone = 'idle'
    icon = <FiBox size={15} className="shrink-0" />
    title = 'Shelf selected'
    detail = 'Place SKUs from the product library onto this shelf'
  } else if (selectedType === 'product') {
    tone = 'product'
    icon = <FiPackage size={15} className="shrink-0" />
    title = 'Product selected'
    detail = 'Alt-click to move · Ctrl+C / Ctrl+V to copy and paste facings'
  }

  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={cn(
          'pointer-events-auto px-3 py-1.5 rounded-full text-[11px] font-semibold',
          PANEL_SHELL,
          'text-gray-300 hover:text-white hover:border-slate-500 transition-all',
          className,
        )}
      >
        Show tips
      </button>
    )
  }

  return (
    <div
      key={pulse}
      className={cn(
        'pointer-events-auto max-w-[min(520px,92vw)] animate-in fade-in slide-in-from-bottom-2 duration-200',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-2xl transition-colors',
          toneClasses(tone),
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl shrink-0',
            tone === 'idle' ? 'bg-white/10' : 'bg-white/15',
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold truncate">{title}</p>
            {(isPlacingRack ||
              isPlacingProduct ||
              movingInventoryFromBinId ||
              editingRackId) && (
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse shrink-0" />
            )}
          </div>
          <p className="text-[11px] opacity-80 leading-snug mt-0.5">{detail}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 transition-colors"
            >
              {action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="px-2 py-1 rounded-lg text-[10px] font-medium opacity-60 hover:opacity-100 hover:bg-white/10 transition-all"
            title="Hide tips"
          >
            Hide
          </button>
        </div>
      </div>
    </div>
  )
}
