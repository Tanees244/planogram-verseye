'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePlanogramStore, type Rack, type RackSide, type Row, type Bin } from '@/store/planogramStore'
import {
  FiChevronDown,
  FiChevronRight,
  FiPlus,
  FiX,
  FiPackage,
  FiLayers,
  FiBox,
  FiShoppingCart,
  FiMapPin,
  FiUpload,
  FiTrash2
} from 'react-icons/fi'
import ProductManagementModal from './ProductManagementModal'
import AttachProductToBinModal from './AttachProductToBinModal'
import { Spinner } from './Spinner'
import { RowDimensionsField } from '@/components/RowHeightsEditor'
import { resolveEntityId, totalProductFacings } from '@/utils/storeLayoutLoader'
import { toastApiError } from '@/utils/apiMessages'
import toast from 'react-hot-toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AddRackModal, type RackFormState } from '@/components/forms/AddRackModal'
import { AddRowModal } from '@/components/forms/AddRowModal'
import { Btn } from '@/components/ui/form'
import {
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
  DEFAULT_RACK_DEPTH,
  DEFAULT_RACK_WIDTH,
  GROCERY_SHELF_SPACING,
} from '@/constants/dimensions'
import { validateRackForm, defaultRackForm } from '@/utils/rackFormUtils'
import { displayRackName } from '@/utils/displayRackName'
import { PRODUCT_MOVE_MIME } from '@/components/ProductPalette'
import { cmInputFromM, formatCm, formatCmPair, formatCmTriple } from '@/utils/lengthUnits'

export function TraditionalView() {
  const {
    area,
    addRack,
    addRow,
    addRowToServer,
    addProduct,
    updateDimensions,
    deleteRack,
    deleteRackFromServer,
    deleteRowFromServer,
    deleteProduct,
    deleteProductFromServer,
    setPendingRackParams,
    addRackError,
    setAddRackError,
    addRackToServer,
    isAddingRack,
    attachProductToBin,
    moveBinInventoryToBin,
    isAttachingProduct,
    isLoadingStoreLayout,
    selectedStoreName,
  } = usePlanogramStore()

  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [expandedBins, setExpandedBins] = useState<Set<string>>(new Set())
  const [showAddRackModal, setShowAddRackModal] = useState(false)
  const [showAddRowModal, setShowAddRowModal] = useState(false)
  const [selectedArea, setSelectedArea] = useState(false)
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null)
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null)
  const [showProductMgmtModal, setShowProductMgmtModal] = useState(false)
  const [showAttachProductModal, setShowAttachProductModal] = useState(false)
  const [addingRow, setAddingRow] = useState(false)
  const [pendingDeleteRowId, setPendingDeleteRowId] = useState<string | null>(null)
  const [pendingDeleteRackId, setPendingDeleteRackId] = useState<string | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const [rackForm, setRackForm] = useState<RackFormState>(defaultRackForm)
  const [rackFormErrors, setRackFormErrors] = useState<Record<string, string | null>>({})
  // Locations for Add Rack (mirror Advanced behaviour)
  const [locations, setLocations] = useState<{ id: string; locationCode: string }[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState(
    () => usePlanogramStore.getState().selectedStoreId ?? ''
  )
  const [locationValidationError, setLocationValidationError] = useState<string | null>(null)
  const [rowForm, setRowForm] = useState({ height: cmInputFromM(GROCERY_SHELF_SPACING), count: '1' })
  const [productForm, setProductForm] = useState({
    name: '',
    color: '#2C5282',
    width: cmInputFromM(DEFAULT_PRODUCT_WIDTH),
    depth: cmInputFromM(DEFAULT_PRODUCT_DEPTH),
    height: cmInputFromM(DEFAULT_PRODUCT_HEIGHT),
    quantity: '1',
  })

  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true)
    setLocationsError(null)
    try {
      const headers: Record<string, string> = {}
      try {
        // use shared utility to read token from cookies
        // lazy import to avoid loading packages during SSR where document may be undefined
        const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
        const t = getPlanogramTokenFromCookie();
        if (t) headers['Authorization'] = `Bearer ${t}`;
      } catch {
        // ignore cookie access errors
      }
      const res = await fetch('/api/locations/list', { headers })
      const data = await res.json()
      if (data.isRequestSuccess && data.data?.locations) {
        setLocations(data.data.locations)
      } else {
        setLocationsError(data.message || 'Failed to load locations')
      }
    } catch {
      setLocationsError('Could not connect to server. Please try again.')
    } finally {
      setLocationsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showAddRackModal) {
      setLocationValidationError(null)
      fetchLocations()
    }
  }, [showAddRackModal, fetchLocations])

  const toggleRack = (rackId: string) => {
    const newExpanded = new Set(expandedRacks)
    if (newExpanded.has(rackId)) {
      newExpanded.delete(rackId)
    } else {
      newExpanded.add(rackId)
    }
    setExpandedRacks(newExpanded)
  }

  const toggleRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId)
    } else {
      newExpanded.add(rowId)
    }
    setExpandedRows(newExpanded)
  }

  const toggleBin = (binId: string) => {
    const newExpanded = new Set(expandedBins)
    if (newExpanded.has(binId)) {
      newExpanded.delete(binId)
    } else {
      newExpanded.add(binId)
    }
    setExpandedBins(newExpanded)
  }

  const handleAttachProductSuccess = async (product: any, quantity: number) => {
    if (selectedBinId) {
      const result = await attachProductToBin(selectedBinId, product, quantity)
      if (!result.success) toastApiError(result.message)
      else toast.success(result.message ?? 'Product attached')
    }
  }

  return (
    <div className="w-screen min-h-screen bg-gray-50/80 relative">
      {isAttachingProduct && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-label="Attaching product"
        >
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-gray-900 shadow-2xl">
            <Spinner />
            <div>
              <p className="text-sm font-semibold">Attaching product…</p>
              <p className="text-[11px] text-gray-500">Updating shelf inventory and refreshing layout</p>
            </div>
          </div>
        </div>
      )}
      {isLoadingStoreLayout && !isAttachingProduct && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-label="Loading store racks"
        >
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 text-gray-900 shadow-2xl min-w-[260px]">
            <Spinner />
            <div>
              <p className="text-sm font-semibold">Loading store racks…</p>
              <p className="text-[11px] text-gray-500 truncate max-w-[240px]">
                {selectedStoreName
                  ? `Fetching fixtures for ${selectedStoreName}`
                  : 'Fetching fixtures, shelves, and products'}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Top toolbar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-end gap-3 shadow-sm">
        <Link href="/planograms" className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-brand border border-brand/20 rounded-lg hover:bg-brand/5 transition-colors">
          <FiLayers /> Planograms
        </Link>
        <Btn variant="secondary" onClick={() => setShowProductMgmtModal(true)}>
          <FiShoppingCart className="inline mr-1" /> Product Catalog
        </Btn>
        <Link href="/import" className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark shadow-sm transition-colors">
          <FiUpload /> Import planogram
        </Link>
      </div>

      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {/* Header */}
        {/* <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 mt-16">Planogram Hierarchy</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <FiMapPin className="text-[#2C5282]" />
              <span><strong>Area:</strong> {formatCmPair(area.width, area.depth)}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiLayers className="text-purple-500" />
              <span><strong>Racks:</strong> {area.racks.length}</span>
            </div>
          </div>
        </div> */}

        {/* Area Section */}
        <div
          onClick={() => setSelectedArea(!selectedArea)}
          className={`mb-6 p-5 rounded-xl cursor-pointer transition-all duration-200 border ${selectedArea
            ? 'bg-brand/5 border-brand shadow-sm'
            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <FiMapPin className={`text-xl ${selectedArea ? 'text-brand' : 'text-gray-400'}`} />
              <span className="text-base font-semibold text-gray-900">Store Area</span>
            </div>
            {selectedArea && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowAddRackModal(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
              >
                <FiPlus /> Add Rack
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500 ml-9">
            {formatCmPair(area.width, area.depth)} · {area.racks.length} rack{area.racks.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Racks */}
        <div className="space-y-4">
          {area.racks.map((rack: Rack) => (
            <div key={rack.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
              <div
                className={`p-4 cursor-pointer flex items-center justify-between transition-colors ${expandedRacks.has(rack.id) ? 'bg-white' : 'bg-white hover:bg-gray-50'
                  }`}
                onClick={() => toggleRack(rack.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedRacks.has(rack.id) ? (
                    <FiChevronDown className="text-xl text-[#2C5282]" />
                  ) : (
                    <FiChevronRight className="text-xl text-gray-400" />
                  )}
                  <FiLayers className="text-xl text-[#2C5282]" />
                  <span className="text-base font-semibold text-gray-800">{displayRackName(rack)}</span>
                  {rack.rackCode ? (
                    <span className="text-xs text-gray-500 font-mono">{rack.rackCode}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedRackId(rack.id)
                      setRowForm({ height: cmInputFromM(GROCERY_SHELF_SPACING), count: '1' })
                      setShowAddRowModal(true)
                    }}
                    className="px-4 py-2 bg-[#2C5282] text-white rounded-lg text-sm font-medium hover:bg-[#1A365D] transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                  >
                    <FiPlus className="text-sm" />
                    Row
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPendingDeleteRackId(rack.id)
                    }}
                    className="px-4 py-2 bg-[#e1e7ef] rounded-lg text-sm font-medium hover:bg-[#fff] transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                  >
                    <FiTrash2 className="text-sm text-red-500" />
                  </button>
                </div>
              </div>

              {expandedRacks.has(rack.id) && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-4 px-2">
                    {formatCmPair(rack.width, rack.depth)} | Sides: {rack.sides.length}
                  </div>
                  {rack.sides.map((side) => (
                    <div key={side.sideCode} className="mb-4 pl-6">
                      <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <FiBox className="text-[#2C5282]" />
                        Side {side.sideCode}
                      </div>
                      <div className="text-[11px] text-gray-500 mb-2 pl-1">
                        Usable side dims: W {formatCm(rack.customConfig ? (rack.customConfig.outerWidth - rack.customConfig.wallThickness * 2) : rack.width * 0.85)}
                        {" · "}
                        D {formatCm(rack.customConfig ? (rack.customConfig.outerDepth - rack.customConfig.wallThickness * 2) : rack.depth * 0.9)}
                        {" · "}
                        H {formatCm(rack.customConfig ? (rack.customConfig.outerHeight - (rack.customConfig.header.enabled ? rack.customConfig.header.height : 0) - (rack.customConfig.footer.enabled ? rack.customConfig.footer.height : 0)) : side.rows.reduce((s, r) => s + r.height, 0))}
                      </div>
                      {side.rows.map((row) => (
                        <div key={row.id} className="mb-3 pl-4">
                          <div
                            className={`p-4 bg-white border border-gray-200 rounded-lg cursor-pointer flex items-center justify-between transition-all hover:shadow-sm ${expandedRows.has(row.id) ? 'border-brand/30 bg-brand/10' : ''
                              }`}
                            onClick={() => toggleRow(row.id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedRows.has(row.id) ? (
                                <FiChevronDown className="text-lg text-[#2C5282]" />
                              ) : (
                                <FiChevronRight className="text-lg text-gray-400" />
                              )}
                              <FiPackage className="text-lg text-[#2C5282]" />
                              <span className="text-sm font-medium text-gray-800">Row {String(row.id).slice(0, 6)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPendingDeleteRowId(row.id)
                                }}
                                className="px-3 py-1.5 bg-[#e1e7ef] text-white rounded-lg text-xs font-medium hover:bg-white transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                              >
                                <FiTrash2 className="text-xs text-red-600" />
                              </button>
                            </div>
                          </div>

                          {expandedRows.has(row.id) && (
                            <div className="mt-3 pl-6 pr-2">
                              <div className="text-xs text-gray-600 mb-3 px-2 flex items-center gap-3 flex-wrap">
                                <span className="font-medium text-gray-700">Height:</span>
                                <RowDimensionsField row={row} dark={false} showLabel={false} />
                                <span className="text-gray-500">
                                  | Depth: {formatCm(rack.customConfig ? (rack.customConfig.outerDepth - rack.customConfig.wallThickness * 2) * 0.95 : rack.depth * 0.9)}
                                  {" | "}SKUs: {row.bins.reduce((n, b) => n + b.products.length, 0)}
                                </span>
                              </div>
                              {row.bins.map((bin) => (
                                <div
                                  key={bin.id}
                                  className="mb-2 pl-2"
                                  onDragOver={(e) => {
                                    if (!e.dataTransfer.types.includes(PRODUCT_MOVE_MIME)) return
                                    e.preventDefault()
                                    e.dataTransfer.dropEffect = 'move'
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    const raw = e.dataTransfer.getData(PRODUCT_MOVE_MIME)
                                    if (!raw) return
                                    let payload: { sourceBinId?: string }
                                    try {
                                      payload = JSON.parse(raw)
                                    } catch {
                                      return
                                    }
                                    if (!payload.sourceBinId || payload.sourceBinId === bin.id) return
                                    void (async () => {
                                      const res = await moveBinInventoryToBin(payload.sourceBinId!, bin.id)
                                      if (res.success) toast.success(res.message ?? 'Moved SKU')
                                      else toast.error(res.message ?? 'Move failed')
                                    })()
                                  }}
                                >
                                  <div
                                    className={`p-3 bg-white border border-gray-200 rounded-lg cursor-pointer flex items-center justify-between transition-all hover:shadow-sm ${expandedBins.has(bin.id) ? 'border-brand/30 bg-brand/10' : ''
                                      }`}
                                    onClick={() => toggleBin(bin.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {expandedBins.has(bin.id) ? (
                                        <FiChevronDown className="text-sm text-[#2C5282]" />
                                      ) : (
                                        <FiChevronRight className="text-sm text-gray-400" />
                                      )}
                                      <FiBox className="text-sm text-[#2C5282]" />
                                        <span className="text-xs font-medium text-gray-800">
                                          Products
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bin.id)) {
                                            alert('This shelf slot has no server id yet. Refresh the store layout.')
                                            return
                                          }
                                          setSelectedBinId(bin.id)
                                          setShowAttachProductModal(true)
                                        }}
                                        className="px-3 py-1.5 bg-[#2C5282] text-white rounded-lg text-xs font-medium hover:bg-[#1A365D] transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                                      >
                                        <FiPlus className="text-xs" />
                                        Product
                                      </button>
                                    </div>
                                  </div>

                                  {
                                    expandedBins.has(bin.id) && (
                                      <div className="mt-2 pl-4 pr-2">
                                        <div className="text-xs text-gray-600 mb-2 px-2">
                                          Shelf: {formatCmTriple(bin.width, bin.depth, bin.height)}
                                          {" · "}
                                          Products: {bin.products.length} SKU{bin.products.length === 1 ? '' : 's'}
                                          {totalProductFacings(bin.products) > bin.products.length
                                            ? ` · ${totalProductFacings(bin.products)} facings`
                                            : ''}
                                        </div>
                                        {bin.products.map((product) => {
                                          const qty = Math.max(1, Math.floor(Number(product.quantity) || 1))
                                          const thumbsToShow = Math.min(qty, 8)
                                          return (
                                          <div
                                            key={product.id}
                                            draggable
                                            onDragStart={(e) => {
                                              e.dataTransfer.setData(
                                                PRODUCT_MOVE_MIME,
                                                JSON.stringify({ mode: 'move', sourceBinId: bin.id }),
                                              )
                                              e.dataTransfer.effectAllowed = 'move'
                                            }}
                                            className="p-2.5 mb-2 bg-white border border-gray-200 rounded-lg flex items-center justify-between hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
                                            title="Drag onto another shelf to move this SKU"
                                          >
                                            <div className="flex items-center gap-3">
                                              {product.imageUrl ? (
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                  {Array.from({ length: thumbsToShow }).map((_, i) => (
                                                    <img
                                                      key={`${product.id}-thumb-${i}`}
                                                      src={product.imageUrl}
                                                      alt={product.name}
                                                      className="w-9 h-9 rounded-md object-cover border border-gray-200 shadow-sm bg-white"
                                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                                    />
                                                  ))}
                                                  {qty > thumbsToShow && (
                                                    <span className="text-[10px] font-semibold text-gray-500 px-1">+{qty - thumbsToShow}</span>
                                                  )}
                                                </div>
                                              ) : (
                                                <div
                                                  className="w-4 h-4 rounded-md shadow-sm"
                                                  style={{ backgroundColor: product.color }}
                                                />
                                              )}
                                              <div className="flex flex-col">
                                                <span className="text-xs font-medium text-gray-800">{product.name}{qty > 1 ? ` × ${qty}` : ''}</span>
                                                <span className="text-[10px] text-gray-500">
                                                  {formatCmTriple(Number(product.width), Number(product.depth), Number(product.height))}
                                                </span>
                                                {(product.brandName || product.categoryName) && (
                                                  <span className="text-[10px] text-gray-500">
                                                    {product.brandName}{product.brandName && product.categoryName ? ' | ' : ''}{product.categoryName}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation()
                                                const res = await deleteProductFromServer(product.id)
                                                if (!res.success && res.message) alert(res.message)
                                              }}
                                              className="p-1.5 bg-[#e1e7ef] text-white rounded-md text-xs hover:bg-white transition-all shadow-sm hover:shadow-md"
                                            >
                                              <FiX className="text-xs text-red-600" />
                                            </button>
                                          </div>
                                          )
                                        })}
                                      </div>
                                    )
                                  }
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ProductManagementModal isOpen={showProductMgmtModal} onClose={() => setShowProductMgmtModal(false)} />

      <AddRackModal
        open={showAddRackModal}
        onClose={() => setShowAddRackModal(false)}
        areaWidth={area.width}
        areaDepth={area.depth}
        form={rackForm}
        onChange={setRackForm}
        locations={locations}
        locationsLoading={locationsLoading}
        locationsError={locationsError}
        selectedLocationId={selectedLocationId}
        onLocationChange={(v) => { setSelectedLocationId(v); setLocationValidationError(null) }}
        errors={{ ...rackFormErrors, location: rackFormErrors.location ?? locationValidationError }}
        globalError={addRackError}
        isSubmitting={isAddingRack}
        onSubmit={async () => {
          const errs = validateRackForm(selectedLocationId, rackForm)
          setRackFormErrors(errs)
          if (Object.keys(errs).length > 0) {
            setLocationValidationError(errs.location ?? null)
            return
          }
          const w = (parseFloat(rackForm.width) || 0) / 100
          const d = (parseFloat(rackForm.depth) || 0) / 100
          const res = await addRackToServer(undefined, {
            width: w || DEFAULT_RACK_WIDTH,
            depth: d || DEFAULT_RACK_DEPTH,
            rackName: rackForm.rackName,
            plankType: rackForm.plankType,
            sided: rackForm.fixtureType === 'GONDOLA' ? rackForm.sided : 'one',
            fixtureType: rackForm.fixtureType,
          }, selectedLocationId)
          if (res.success) {
            const name = (rackForm.rackName || '').trim()
            if (name) {
              void import('@/utils/userEnteredNames').then(({ rememberUserEnteredName }) => {
                rememberUserEnteredName('rack', name)
              })
            }
            setShowAddRackModal(false)
          }
        }}
      />

      <AddRowModal
        open={showAddRowModal}
        onClose={() => setShowAddRowModal(false)}
        height={rowForm.height}
        onHeightChange={(v) => setRowForm({ ...rowForm, height: v })}
        count={rowForm.count}
        onCountChange={(v) => setRowForm({ ...rowForm, count: v })}
        isSubmitting={addingRow}
        onSubmit={async () => {
          if (!selectedRackId) return
          setAddingRow(true)
          try {
            const h = parseFloat(rowForm.height) / 100 || GROCERY_SHELF_SPACING
            const n = Math.max(1, Math.min(20, Math.floor(Number(rowForm.count) || 1)))
            let added = 0
            let lastMsg: string | undefined
            for (let i = 0; i < n; i++) {
              const res = await addRowToServer(selectedRackId, h, undefined, { quiet: i > 0 })
              if (!res.success) {
                lastMsg = res.message
                break
              }
              added += 1
            }
            if (added === 0) setAddRackError(lastMsg ?? 'Failed to add row')
            else setShowAddRowModal(false)
          } finally {
            setAddingRow(false)
          }
        }}
      />

      {selectedBinId && (
        <AttachProductToBinModal
          isOpen={showAttachProductModal}
          onClose={() => setShowAttachProductModal(false)}
          binId={selectedBinId}
          onSuccess={handleAttachProductSuccess}
          logPayload
        />
      )}

      <ConfirmModal
        open={Boolean(pendingDeleteRowId)}
        title="Delete row?"
        description="All products on this shelf will be removed. This cannot be undone."
        confirmLabel="Delete row"
        danger
        busy={confirmBusy}
        onClose={() => {
          if (!confirmBusy) setPendingDeleteRowId(null)
        }}
        onConfirm={async () => {
          if (!pendingDeleteRowId) return
          setConfirmBusy(true)
          try {
            const res = await deleteRowFromServer(pendingDeleteRowId)
            if (!res.success) toastApiError(res.message)
            else {
              toast.success(res.message ?? 'Row deleted')
              setPendingDeleteRowId(null)
            }
          } finally {
            setConfirmBusy(false)
          }
        }}
      />
      <ConfirmModal
        open={Boolean(pendingDeleteRackId)}
        title="Delete rack?"
        description="This removes the rack and every shelf, SKU, and POSM on it. This cannot be undone."
        confirmLabel="Delete rack"
        danger
        busy={confirmBusy}
        onClose={() => {
          if (!confirmBusy) setPendingDeleteRackId(null)
        }}
        onConfirm={async () => {
          if (!pendingDeleteRackId) return
          setConfirmBusy(true)
          try {
            const res = await deleteRackFromServer(pendingDeleteRackId)
            if (!res.success) toastApiError(res.message)
            else setPendingDeleteRackId(null)
          } finally {
            setConfirmBusy(false)
          }
        }}
      />

    </div>
  )
}