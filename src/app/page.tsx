// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { TraditionalView } from '@/components/TraditionalView'
import { ContextAddButton } from '@/components/ContextAddButton'
import Link from 'next/link'
import { usePlanogramStore, type Bin, type Product } from '@/store/planogramStore'
import AutoPlaceRacks from '@/components/AutoPlaceRacks'
import LoadRowsOnRackSelect from '@/components/LoadRowsOnRackSelect'

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
    <div className="absolute top-4 right-4 z-[100]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-2 bg-black/60 backdrop-blur-sm text-gray-300 hover:text-white rounded-lg text-sm border border-white/20 hover:border-white/40 transition-colors"
        title="View controls"
      >
        Controls
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 px-4 py-3 min-w-[320px] bg-black/85 backdrop-blur-sm text-gray-200 rounded-xl text-sm border border-white/20 shadow-xl">
          {MOVE_HINT}
        </div>
      )}
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
    color: '#3498db',
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
        <div className="absolute top-4 left-4 z-[100] flex gap-2 bg-white/95 backdrop-blur-sm px-2 py-2 rounded-xl shadow-lg">
          <button
            onClick={() => setViewMode('traditional')}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-[#002952] text-white shadow-md"
          >
            Traditional
          </button>
          <button
            onClick={() => setViewMode('advanced')}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all text-[#000] hover:bg-gray-200"
          >
            Advanced
          </button>
        </div>
        <TraditionalView />
      </div>
    )
  }

  // Render Advanced View (3D)
  return (
    <div className="w-screen h-screen relative">
      {/* View Mode Toggle */}
      <div className="absolute top-4 left-4 z-[100] flex gap-2 bg-black/70 backdrop-blur-sm px-2 py-2 rounded-xl shadow-lg">
        <button
          onClick={() => setViewMode('traditional')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-transparent text-gray-200 border border-white/30 hover:bg-white/10"
        >
          Traditional
        </button>
        <button
          onClick={() => setViewMode('advanced')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-[#002952] text-white"
        >
          Advanced
        </button>
      </div>
      <Scene3D />
      <AutoPlaceRacks />
      <LoadRowsOnRackSelect />

      {/* Bottom bar: context action (Add Rack / Row / Bin / Product) */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 z-[100]">
        <ContextAddButton />
      </div>

      {/* Top-right: controls tooltip – click to show move hints */}
      <ControlsTooltip />
    </div>
  )
}
