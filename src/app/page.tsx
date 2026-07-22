// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ViewModeToggle } from '@/components/ui/ViewModeToggle'
import { FixturePalette } from '@/components/FixturePalette'
import { ProductPalette } from '@/components/ProductPalette'
import { cn } from '@/lib/cn'
import { SceneTopBar } from '@/components/SceneTopBar'
import { PlanogramClipboardHotkeys } from '@/components/PlanogramClipboardHotkeys'
import { CustomRackBuilder } from '@/components/CustomRackBuilder'
import { TraditionalView } from '@/components/TraditionalView'
import { ContextAddButton } from '@/components/ContextAddButton'
import { Spinner } from '@/components/Spinner'
import Link from 'next/link'
import { usePlanogramStore, type Bin, type Product } from '@/store/planogramStore'
import StoreLayout from '@/components/StoreLayout'
import {
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
  DEFAULT_RACK_DEPTH,
  DEFAULT_RACK_WIDTH,
  GROCERY_SHELF_SPACING,
} from '@/constants/dimensions'

const Scene3D = dynamic(() => import('@/components/Scene3D').then((m) => ({ default: m.Scene3D })), { ssr: false })

type Racks = ReturnType<typeof usePlanogramStore.getState>['area']['racks']

function getBinById(racks: Racks, binId: string) {
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        const bin = row.bins.find((b: Bin) => b.id === binId)
        if (bin) return bin
      }
    }
  }
  return null
}

function getRackByRowId(racks: Racks, rowId: string) {
  for (const rack of racks) {
    for (const side of rack.sides) {
      if (side.rows.some((row: { id: string }) => row.id === rowId)) return rack
    }
  }
  return null
}

function getRowById(racks: Racks, rowId: string) {
  for (const rack of racks) {
    for (const side of rack.sides) {
      const row = side.rows.find((r: { id: string }) => r.id === rowId)
      if (row) return row
    }
  }
  return null
}

function getRackById(racks: Racks, rackId: string) {
  return racks.find((r: { id: string }) => r.id === rackId) ?? null
}

function getProductById(racks: Racks, productId: string) {
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        for (const bin of row.bins) {
          const product = bin.products.find((p: Product) => p.id === productId)
          if (product) return product
        }
      }
    }
  }
  return null
}

function StoreBadge({ dark = false, align = 'center' }: { dark?: boolean; align?: 'center' | 'right' }) {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)
  const isLoadingStoreLayout = usePlanogramStore((s) => s.isLoadingStoreLayout)
  const isSavingLayout = usePlanogramStore((s) => s.isSavingLayout)
  const saveStoreLayoutToServer = usePlanogramStore((s) => s.saveStoreLayoutToServer)
  const setSelectedStore = usePlanogramStore((s) => s.setSelectedStore)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  if (!selectedStoreId) return null

  const badge = (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl shadow-md text-sm ${dark ? 'bg-black/70 backdrop-blur-sm text-gray-100' : 'bg-white border border-gray-200 text-gray-800'
        }`}
    >
      {(isLoadingStoreLayout || isSavingLayout) && (
        <span className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin shrink-0" />
      )}
      <span className="font-semibold truncate max-w-[280px]">
        {isLoadingStoreLayout
          ? 'Loading layout…'
          : isSavingLayout
            ? 'Saving layout…'
            : (selectedStoreName || 'Selected store')}
      </span>
      {!isLoadingStoreLayout && (
        <>
          <button
            type="button"
            disabled={isSavingLayout}
            onClick={async () => {
              setSaveMessage(null)
              const res = await saveStoreLayoutToServer()
              setSaveMessage(res.message ?? (res.success ? 'Saved' : 'Save failed'))
              setTimeout(() => setSaveMessage(null), 4000)
            }}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 disabled:opacity-50 ${dark ? 'bg-brand/30 hover:bg-brand/40 text-white' : 'bg-brand/10 hover:bg-brand/20 text-brand'
              }`}
          >
            Save all
          </button>
          <button
            onClick={() => setSelectedStore(null)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${dark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-brand/10 hover:bg-brand/20 text-brand'
              }`}
          >
            Change
          </button>
        </>
      )}
      {saveMessage && (
        <span className="text-[10px] text-brand-light truncate max-w-[140px]">{saveMessage}</span>
      )}
    </div>
  )

  if (align === 'right') return badge

  return (
    <div className="absolute top-[4.75rem] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <div className="pointer-events-auto">{badge}</div>
    </div>
  )
}

export default function Home() {
  const {
    area,
    viewMode,
    selectedId,
    selectedType,
    setViewMode,
    setSelected,
    setIsPlacingRack,
    setPendingRackParams,
    addRack,
    addRow,
    addBin,
    addProduct,
    addProductError,
    updateDimensions,
    updateRackPosition,
    deleteRack,
    deleteRow,
    deleteBin,
    deleteProduct,
  } = usePlanogramStore()

  const productPaletteCollapsed = usePlanogramStore((s) => s.productPaletteCollapsed)
  const isAddingRack = usePlanogramStore((s) => s.isAddingRack)
  const productLibraryOpen = !productPaletteCollapsed
  const contextPanelActive =
    selectedType === 'rack' ||
    selectedType === 'row' ||
    selectedType === 'bin' ||
    selectedType === 'product'

  const [showAddRackModal, setShowAddRackModal] = useState(false)
  const [showAddRowModal, setShowAddRowModal] = useState(false)
  const [rackForm, setRackForm] = useState({
    width: String(DEFAULT_RACK_WIDTH),
    length: String(DEFAULT_RACK_DEPTH),
    plankType: 'standard' as string,
    sided: 'one' as 'one' | 'two',
  })
  const [rowHeightInput, setRowHeightInput] = useState(String(GROCERY_SHELF_SPACING)) // string so user can clear field
  const [rowSidedInput, setRowSidedInput] = useState<'one' | 'two'>('one')
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [productForm, setProductForm] = useState({
    name: '',
    color: '#2C5282',
    width: String(DEFAULT_PRODUCT_WIDTH),
    depth: String(DEFAULT_PRODUCT_DEPTH),
    height: String(DEFAULT_PRODUCT_HEIGHT),
    quantity: '1',
  })

  const [editAreaStr, setEditAreaStr] = useState({ width: '', depth: '' })
  const [editRackStr, setEditRackStr] = useState({ width: '', depth: '', posX: '', posZ: '', rotX: '', rotY: '', rotZ: '' })
  const [editRowStr, setEditRowStr] = useState({ height: '' })
  const [editBinStr, setEditBinStr] = useState({ width: '', depth: '', height: '' })
  const [editProductStr, setEditProductStr] = useState({ width: '', depth: '', height: '' })

  useEffect(() => {
    if (selectedType === 'area') setEditAreaStr({ width: String(area.width), depth: String(area.depth) })
  }, [selectedType, selectedId, area.width, area.depth])
  useEffect(() => {
    if (selectedType === 'rack' && selectedId) {
      const r = getRackById(area.racks, selectedId)
      if (r) {
        const rot = r.rotation ?? { x: 0, y: 0, z: 0 }
        setEditRackStr({
          width: String(r.width),
          depth: String(r.depth),
          posX: String(r.position.x),
          posZ: String(r.position.z),
          rotX: String((rot.x * 180 / Math.PI).toFixed(1)),
          rotY: String((rot.y * 180 / Math.PI).toFixed(1)),
          rotZ: String((rot.z * 180 / Math.PI).toFixed(1)),
        })
      }
    }
  }, [selectedType, selectedId, area.racks])
  useEffect(() => {
    if (selectedType === 'row' && selectedId) {
      const row = getRowById(area.racks, selectedId)
      if (row) setEditRowStr({ height: String(row.height) })
    }
  }, [selectedType, selectedId, area.racks])
  useEffect(() => {
    if (selectedType === 'bin' && selectedId) {
      const bin = getBinById(area.racks, selectedId)
      if (bin) setEditBinStr({ width: String(bin.width), depth: String(bin.depth), height: String(bin.height) })
    }
  }, [selectedType, selectedId, area.racks])
  useEffect(() => {
    if (selectedType === 'product' && selectedId) {
      const p = getProductById(area.racks, selectedId)
      if (p) setEditProductStr({ width: String(p.width), depth: String(p.depth), height: String(p.height) })
    }
  }, [selectedType, selectedId, area.racks])

  const selectedBin = selectedId && selectedType === 'bin' ? getBinById(area.racks, selectedId) : null
  const usedWidth = selectedBin ? selectedBin.products.reduce((s: number, p: Product) => s + p.width, 0) : 0
  const remainingWidth = selectedBin ? (selectedBin.width - usedWidth) * 100 : 0

  // Render Traditional View
  if (viewMode === 'traditional') {
    return (
      <div className="w-screen h-screen relative">
        {/* View Mode Toggle */}
        <div className="absolute top-4 left-4 z-[100]">
          <ViewModeToggle mode="traditional" onChange={setViewMode} />
        </div>
        {/* Store selector + full layout loader (racks → sides → rows → bins → products) */}
        <StoreLayout />
        <StoreBadge />
        <TraditionalView />
      </div>
    )
  }

  // Render Advanced View (3D)
  return (
    <div className="w-screen h-screen relative">
      {/* View mode + fixture library + products + context (left column) */}
      <div className="absolute top-4 left-4 bottom-4 z-[100] flex flex-col gap-2 items-stretch w-[272px] min-h-0">
        <ViewModeToggle mode="advanced" onChange={setViewMode} dark />
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
          {/* Fixtures expand when Products is collapsed and nothing is selected */}
          <div
            className={cn(
              'min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin flex flex-col',
              !productLibraryOpen && !contextPanelActive
                ? 'flex-1 basis-0'
                : productLibraryOpen && !contextPanelActive
                  ? 'shrink-0 max-h-[min(42vh,340px)]'
                  : 'shrink-0 max-h-[min(32vh,260px)]',
            )}
          >
            <FixturePalette fillHeight={!productLibraryOpen && !contextPanelActive} />
          </div>

          {/* Products: fill leftover when open; chip when collapsed */}
          <div
            className={cn(
              'min-h-0 flex flex-col',
              productLibraryOpen
                ? contextPanelActive
                  ? 'flex-1 basis-0 min-h-[140px]'
                  : 'flex-1 basis-0'
                : 'shrink-0',
            )}
          >
            <ProductPalette />
          </div>

          {/* Rack/row/bin actions */}
          <div
            className={cn(
              'min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin',
              contextPanelActive ? 'flex-1 basis-0 min-h-[160px]' : 'shrink-0',
            )}
          >
            <ContextAddButton layout="sidebar" />
          </div>
        </div>
      </div>
      <Scene3D />
      <StoreLayout />
      <CustomRackBuilder />
      <PlanogramClipboardHotkeys />

      <SceneTopBar className="absolute top-4 right-4 z-[100]" />
      {isAddingRack && (
        <div
          className="absolute inset-0 z-[200] flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-label="Placing rack"
        >
          <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/80 px-5 py-4 text-white shadow-2xl">
            <Spinner className="h-5 w-5 text-brand-light" />
            <div>
              <p className="text-sm font-semibold">Placing rack…</p>
              <p className="text-[11px] text-gray-300">Creating fixture, shelves, and bins</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
