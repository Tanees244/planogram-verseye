// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { ViewModeToggle } from '@/components/ui/ViewModeToggle'
import { FixturePalette } from '@/components/FixturePalette'
import { DayNightToggle } from '@/components/ui/DayNightToggle'
import { RoofToggle, RoofHint } from '@/components/ui/RoofToggle'
import { TraditionalView } from '@/components/TraditionalView'
import { ContextAddButton } from '@/components/ContextAddButton'
import Link from 'next/link'
import { usePlanogramStore, type Bin, type Product } from '@/store/planogramStore'
import StoreLayout from '@/components/StoreLayout'

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

const MOVE_HINT =
  'Move: Left-drag orbit · Right-drag pan · Scroll zoom · Click objects to focus camera'

function ControlsTooltip() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-2 bg-black/60 backdrop-blur-sm text-gray-300 hover:text-white rounded-lg text-sm border border-white/20 hover:border-white/40 transition-colors"
        title="View controls"
      >
        Controls
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 px-4 py-3 min-w-[320px] bg-black/85 backdrop-blur-sm text-gray-200 rounded-xl text-sm border border-white/20 shadow-xl z-10">
          {MOVE_HINT}
        </div>
      )}
    </div>
  )
}

function StoreBadge({ dark = false, align = 'center' }: { dark?: boolean; align?: 'center' | 'right' }) {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)
  const isLoadingStoreLayout = usePlanogramStore((s) => s.isLoadingStoreLayout)
  const setSelectedStore = usePlanogramStore((s) => s.setSelectedStore)
  if (!selectedStoreId) return null

  const badge = (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl shadow-md text-sm ${dark ? 'bg-black/70 backdrop-blur-sm text-gray-100' : 'bg-white border border-gray-200 text-gray-800'
        }`}
    >
      {isLoadingStoreLayout && (
        <span className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin shrink-0" />
      )}
      <span className="font-semibold truncate max-w-[280px]">
        {isLoadingStoreLayout ? 'Loading layout…' : (selectedStoreName || 'Selected store')}
      </span>
      {!isLoadingStoreLayout && (
        <button
          onClick={() => setSelectedStore(null)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${dark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-brand/10 hover:bg-brand/20 text-brand'
            }`}
        >
          Change
        </button>
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

  const [showAddRackModal, setShowAddRackModal] = useState(false)
  const [showAddRowModal, setShowAddRowModal] = useState(false)
  const [rackForm, setRackForm] = useState({ width: '2.5', length: '2', plankType: 'standard' as string, sided: 'one' as 'one' | 'two' })
  const [rowHeightInput, setRowHeightInput] = useState('1.5') // string so user can clear field
  const [rowSidedInput, setRowSidedInput] = useState<'one' | 'two'>('one')
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [productForm, setProductForm] = useState({
    name: '',
    color: '#2C5282',
    width: '0.15',
    depth: '0.2',
    height: '0.08',
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
      {/* View mode + fixture library (left) */}
      <div className="absolute top-4 left-4 z-[100] flex flex-col gap-2 items-start">
        <ViewModeToggle mode="advanced" onChange={setViewMode} dark />
        <FixturePalette />
      </div>
      <Scene3D />
      <StoreLayout />

      {/* Top-right: day/night, roof, controls, store name */}
      <div className="absolute top-4 right-4 z-[100] flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <DayNightToggle dark />
          <RoofToggle dark />
          <ControlsTooltip />
        </div>
        <RoofHint />
        <StoreBadge dark align="right" />
      </div>

      {/* Bottom bar: context action (Add Rack / Row / Bin / Product) */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 z-[100]">
        <ContextAddButton />
      </div>
    </div>
  )
}
