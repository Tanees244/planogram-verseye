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
import RackListSidebar from './RackListSidebar'
import ProductManagementModal from './ProductManagementModal'
import AttachProductToBinModal from './AttachProductToBinModal'
import { Spinner } from './Spinner'

export function TraditionalView() {
  const {
    area,
    addRack,
    addRow,
    addRowToServer,
    addBinToServer,
    addBin,
    addProduct,
    addProductToServer,
    updateDimensions,
    deleteRack,
    deleteRackFromServer,
    deleteRow,
    deleteBin,
    deleteProduct,
    setPendingRackParams,
    addRackError,
    setAddRackError,
    addRackToServer,
    isAddingRack,
    attachProductToBin,
  } = usePlanogramStore()

  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [expandedBins, setExpandedBins] = useState<Set<string>>(new Set())
  const [showAddRackModal, setShowAddRackModal] = useState(false)
  const [showAddRowModal, setShowAddRowModal] = useState(false)
  const [showAddBinModal, setShowAddBinModal] = useState(false)
  const [selectedArea, setSelectedArea] = useState(false)
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [selectedBinId, setSelectedBinId] = useState<string | null>(null)
  const [showProductMgmtModal, setShowProductMgmtModal] = useState(false)
  const [showAttachProductModal, setShowAttachProductModal] = useState(false)
  const [binNameInput, setBinNameInput] = useState('')
  const [binNameError, setBinNameError] = useState<string | null>(null)
  const [addingRow, setAddingRow] = useState(false)
  const [addingBin, setAddingBin] = useState(false)

  const [rackForm, setRackForm] = useState({ width: '2.5', length: '2', rackCode: '', plankType: 'standard', sided: 'one' as 'one' | 'two' })
  // Locations for Add Rack (mirror Advanced behaviour)
  const [locations, setLocations] = useState<{ id: string; locationCode: string }[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [locationValidationError, setLocationValidationError] = useState<string | null>(null)
  const [rowForm, setRowForm] = useState({ height: '1.5' })
  const [productForm, setProductForm] = useState({
    name: '',
    color: '#3498db',
    width: '0.15',
    depth: '0.2',
    height: '0.08',
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
      await attachProductToBin(selectedBinId, product, quantity);
    }
  }

  return (
    <div className="w-screen h-screen relative overflow-y-scroll">
      <div className="w-72 p-5 bg-white border-gray-200">
        <RackListSidebar />
      </div>
      <Link
        href="/import"
        className="absolute top-6 right-6 px-6 py-3 bg-[#002952] text-white rounded-xl text-base font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 z-50 flex items-center gap-2"
      >
        <FiUpload className="text-lg" />
        Import JSON
      </Link>
      <button
        onClick={() => setShowProductMgmtModal(true)}
        className="absolute top-6 right-[215px] px-6 py-3 bg-[#002952] text-white rounded-xl text-base font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 z-50 flex items-center gap-2"
      >
        Add Products
      </button>

      {/* Product Management Modal */}
      <ProductManagementModal
        isOpen={showProductMgmtModal}
        onClose={() => setShowProductMgmtModal(false)}
      />


      {/* Main Content */}
      <div className="flex-1 bg-white overflow-y-auto p-8">
        {/* Header */}
        {/* <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 mt-16">Planogram Hierarchy</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <FiMapPin className="text-[#002952]" />
              <span><strong>Area:</strong> {area.width}m × {area.depth}m</span>
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
          className={`mb-6 p-5 rounded-xl cursor-pointer transition-all duration-200 ${selectedArea
            ? 'bg-blue-50 border-2 border-[#002952] shadow-md'
            : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <FiMapPin className={`text-2xl ${selectedArea ? 'text-[#002952]' : 'text-gray-400'}`} />
              <span className="text-lg font-semibold text-[#002952]">Area</span>
            </div>
            {selectedArea && (
              <button
                onClick={() => setShowAddRackModal(true)}
                className="px-4 py-2 bg-[#002952] text-white rounded-lg text-sm font-medium hover:bg-[#002952] transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <FiPlus className="text-base" />
                Add Rack
              </button>
            )}
          </div>
          <div className="text-sm text-gray-600 ml-11">
            Width: {area.width}m | Depth: {area.depth}m
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
                    <FiChevronDown className="text-xl text-[#002952]" />
                  ) : (
                    <FiChevronRight className="text-xl text-gray-400" />
                  )}
                  <FiLayers className="text-xl text-[#002952]" />
                  <span className="text-base font-semibold text-gray-800">Rack {rack.rackCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedRackId(rack.id)
                      setShowAddRowModal(true)
                    }}
                    className="px-4 py-2 bg-[#002952] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                  >
                    <FiPlus className="text-sm" />
                    Row
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      const res = await deleteRackFromServer(rack.id)
                      if (!res.success) {
                        alert(res.message)
                      }
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
                    {rack.width}m × {rack.depth}m | Sides: {rack.sides.length}
                  </div>
                  {rack.sides.map((side) => (
                    <div key={side.sideCode} className="mb-4 pl-6">
                      <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <FiBox className="text-[#002952]" />
                        Side {side.sideCode}
                      </div>
                      {side.rows.map((row) => (
                        <div key={row.id} className="mb-3 pl-4">
                          <div
                            className={`p-4 bg-white border border-gray-200 rounded-lg cursor-pointer flex items-center justify-between transition-all hover:shadow-sm ${expandedRows.has(row.id) ? 'border-blue-300 bg-blue-50' : ''
                              }`}
                            onClick={() => toggleRow(row.id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedRows.has(row.id) ? (
                                <FiChevronDown className="text-lg text-[#002952]" />
                              ) : (
                                <FiChevronRight className="text-lg text-gray-400" />
                              )}
                              <FiPackage className="text-lg text-[#002952]" />
                              <span className="text-sm font-medium text-gray-800">Row {row.id.slice(0, 6)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedRowId(row.id)
                                  setShowAddBinModal(true)
                                }}
                                className="px-3 py-1.5 bg-[#002952] text-white rounded-lg text-xs font-medium hover:bg-[#001a33] transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                              >
                                <FiPlus className="text-xs" />
                                Bin
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteRow(row.id)
                                }}
                                className="px-3 py-1.5 bg-[#e1e7ef] text-white rounded-lg text-xs font-medium hover:bg-white transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                              >
                                <FiTrash2 className="text-xs text-red-600" />
                              </button>
                            </div>
                          </div>

                          {expandedRows.has(row.id) && (
                            <div className="mt-3 pl-6 pr-2">
                              <div className="text-xs text-gray-600 mb-3 px-2">
                                Height: {row.height}m | Bins: {row.bins.length}
                              </div>
                              {row.bins.map((bin) => (
                                <div key={bin.id} className="mb-2 pl-2">
                                  <div
                                    className={`p-3 bg-white border border-gray-200 rounded-lg cursor-pointer flex items-center justify-between transition-all hover:shadow-sm ${expandedBins.has(bin.id) ? 'border-[#002952] bg-[#002952]' : ''
                                      }`}
                                    onClick={() => toggleBin(bin.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      {expandedBins.has(bin.id) ? (
                                        <FiChevronDown className="text-sm text-[#002952]" />
                                      ) : (
                                        <FiChevronRight className="text-sm text-gray-400" />
                                      )}
                                      <FiBox className="text-sm text-[#002952]" />
                                      <span className="text-xs font-medium text-gray-800">Bin {bin.id.slice(0, 6)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedBinId(bin.id)
                                          setShowAttachProductModal(true)
                                        }}
                                        className="px-3 py-1.5 bg-[#002952] text-white rounded-lg text-xs font-medium hover:bg-[#001a33] transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                                      >
                                        <FiPlus className="text-xs" />
                                        Product
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          deleteBin(bin.id)
                                        }}
                                        className="px-3 py-1.5 bg-[#e1e7ef] text-white rounded-lg text-xs font-medium hover:bg-white transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
                                      >
                                        <FiTrash2 className="text-xs text-red-600" />
                                      </button>
                                    </div>
                                  </div>

                                  {
                                    expandedBins.has(bin.id) && (
                                      <div className="mt-2 pl-4 pr-2">
                                        <div className="text-xs text-gray-600 mb-2 px-2">
                                          Products: {bin.products.length}
                                        </div>
                                        {bin.products.map((product) => (
                                          <div
                                            key={product.id}
                                            className="p-2.5 mb-2 bg-white border border-gray-200 rounded-lg flex items-center justify-between hover:shadow-sm transition-all"
                                          >
                                            <div className="flex items-center gap-3">
                                              <div
                                                className="w-4 h-4 rounded-md shadow-sm"
                                                style={{ backgroundColor: product.color }}
                                              />
                                              <div className="flex flex-col">
                                                <span className="text-xs font-medium text-gray-800">{product.name}</span>
                                                {(product.brandName || product.categoryName) && (
                                                  <span className="text-[10px] text-gray-500">
                                                    {product.brandName}{product.brandName && product.categoryName ? ' | ' : ''}{product.categoryName}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                deleteProduct(product.id)
                                              }}
                                              className="p-1.5 bg-[#e1e7ef] text-white rounded-md text-xs hover:bg-white transition-all shadow-sm hover:shadow-md"
                                            >
                                              <FiX className="text-xs text-red-600" />
                                            </button>
                                          </div>
                                        ))}
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

      {/* Modals */}
      {/* Add Rack Modal */}
      {
        showAddRackModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddRackModal(false)}>
            <div className="bg-white rounded-2xl p-6 min-w-[500px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Add Rack</h3>
              <p className="text-sm text-gray-600 mb-4">Warehouse floor: {area.width} m × {area.depth} m</p>
              {addRackError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  {addRackError}
                </div>
              )}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => {
                      setSelectedLocationId(e.target.value)
                      setLocationValidationError(null)
                    }}
                    disabled={locationsLoading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base bg-white"
                  >
                    <option value="">{locationsLoading ? 'Loading locations…' : 'Select a location'}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.locationCode}</option>
                    ))}
                  </select>
                  {locationValidationError && (
                    <div className="text-sm text-red-600 mt-2">{locationValidationError}</div>
                  )}
                  {locationsError && (
                    <div className="text-sm text-amber-600 mt-2">{locationsError}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rack Code (Required)</label>
                  <input
                    type="text"
                    value={rackForm.rackCode}
                    onChange={(e) => setRackForm({ ...rackForm, rackCode: e.target.value })}
                    placeholder="Enter business code (e.g. RACK-01)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Width (m)</label>
                  <input
                    type="text"
                    value={rackForm.width}
                    onChange={(e) => setRackForm({ ...rackForm, width: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Length (m)</label>
                  <input
                    type="text"
                    value={rackForm.length}
                    onChange={(e) => setRackForm({ ...rackForm, length: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  />
                </div>
                {/* <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Plank Type</label>
                  <select
                    value={rackForm.plankType}
                    onChange={(e) => setRackForm({ ...rackForm, plankType: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base bg-white"
                  >
                    <option value="standard">Standard</option>
                    <option value="heavy">Heavy duty</option>
                    <option value="light">Light</option>
                  </select>
                </div> */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sides</label>
                  <select
                    value={rackForm.sided}
                    onChange={(e) => setRackForm({ ...rackForm, sided: e.target.value as 'one' | 'two' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base bg-white"
                  >
                    <option value="one">One sided</option>
                    <option value="two">Two sided</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-8 justify-end">
                <button
                  onClick={() => setShowAddRackModal(false)}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // validate location selection
                    if (!selectedLocationId || !selectedLocationId.trim()) {
                      setLocationValidationError('Location is required')
                      return
                    }
                    if (!rackForm.rackCode.trim()) {
                      setAddRackError('Rack code is required')
                      return
                    }
                    const w = parseFloat(rackForm.width) || 2.5
                    const d = parseFloat(rackForm.length) || 2
                    const res = await addRackToServer(undefined, {
                      width: w,
                      depth: d,
                      rackCode: rackForm.rackCode,
                      plankType: rackForm.plankType,
                      sided: rackForm.sided,
                    }, selectedLocationId)
                    if (res.success) {
                      setShowAddRackModal(false)
                    }
                  }}
                  disabled={isAddingRack}
                  className="px-6 py-3 bg-[#002952] text-white rounded-xl text-base font-medium hover:bg-[#001a33] transition-all shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAddingRack && <Spinner />}
                  {isAddingRack ? 'Adding...' : 'Add Rack'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Row Modal */}
      {
        showAddRowModal && selectedRackId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddRowModal(false)}>
            <div className="bg-white rounded-2xl p-8 min-w-[400px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Add Row</h3>
              <p className="text-sm text-gray-600 mb-4">Row will match the rack: one-sided rack → one-sided row; two-sided rack → row added on both sides.</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Height (m)</label>
                <input
                  type="text"
                  value={rowForm.height}
                  onChange={(e) => setRowForm({ ...rowForm, height: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
                />
              </div>
              <div className="flex gap-3 mt-8 justify-end">
                <button
                  onClick={() => setShowAddRowModal(false)}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setAddingRow(true)
                    try {
                      const res = await addRowToServer(selectedRackId, parseFloat(rowForm.height) || 1.5)
                      if (!res.success) {
                        setAddRackError(res.message)
                      } else {
                        setShowAddRowModal(false)
                      }
                    } finally {
                      setAddingRow(false)
                    }
                  }}
                  disabled={addingRow}
                  className="px-6 py-3 bg-[#002952] text-white rounded-xl text-base font-medium hover:bg-[#001a33] transition-all shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addingRow && <Spinner />}
                  {addingRow ? 'Adding...' : 'Add Row'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Bin Modal */}
      {
        showAddBinModal && selectedRowId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddBinModal(false)}>
            <div className="bg-white rounded-2xl p-8 min-w-[400px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Add Bin</h3>
              <div className="text-base text-gray-600 mb-6">
                Bin will be automatically sized based on row dimensions
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bin Name</label>
                <input
                  value={binNameInput}
                  onChange={(e) => { setBinNameInput(e.target.value); setBinNameError(null); }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter bin name"
                />
                {binNameError && <div className="text-red-500 text-sm mt-1">{binNameError}</div>}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowAddBinModal(false)}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!selectedRowId) return
                    if (!binNameInput || !binNameInput.trim()) {
                      setBinNameError('Bin name is required')
                      return
                    }
                    setAddingBin(true)
                    try {
                      const res = await addBinToServer(selectedRowId, undefined, undefined, undefined, binNameInput.trim())
                      if (!res.success) {
                        setAddRackError(res.message)
                      } else {
                        console.log('[Traditional] CreateBin response ->', res)
                        if ((res as any).binId) {
                          setSelectedBinId((res as any).binId)
                        }
                        setShowAddBinModal(false)
                        setBinNameInput('')
                        setBinNameError(null)
                      }
                    } finally {
                      setAddingBin(false)
                    }
                  }}
                  disabled={addingBin}
                  className="px-6 py-3 bg-[#002952] text-white rounded-xl text-base font-medium hover:bg-[#001a33] transition-all shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addingBin && <Spinner />}
                  {addingBin ? 'Adding...' : 'Add Bin'}
                </button>
              </div>
            </div>
          </div>
        )
      }



      {/* Attach Product to Bin Modal */}
      {
        selectedBinId && (
          <AttachProductToBinModal
            isOpen={showAttachProductModal}
            onClose={() => setShowAttachProductModal(false)}
            binId={selectedBinId}
            onSuccess={handleAttachProductSuccess}
            logPayload={true}
          />
        )
      }
    </div >
  )
}
