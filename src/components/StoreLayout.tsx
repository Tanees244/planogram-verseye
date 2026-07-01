"use client"

import { useEffect, useRef, useState } from 'react'
import { FiMapPin, FiSearch } from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import { authHeaders, fetchStoreLayoutRacks, gridPlaceRacks } from '@/utils/storeLayoutLoader'

interface Branch {
  id: string
  name: string
  address?: string
  storeType?: string
}

/**
 * On refresh the user is prompted to pick a store (branch). Once a store is
 * selected, the entire layout (racks → sides → rows → bins → products) is loaded
 * in a single call to /api/racks/by-store/{storeId} and hydrated into the store.
 */
export default function StoreLayout() {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const setSelectedStore = usePlanogramStore((s) => s.setSelectedStore)
  const areaWidth = usePlanogramStore((s) => s.area.width)
  const areaDepth = usePlanogramStore((s) => s.area.depth)

  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingLayout, setLoadingLayout] = useState(false)
  const [search, setSearch] = useState('')
  const restoredRef = useRef(false)
  const loadedStoreRef = useRef<string | null>(null)

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    try {
      const id = window.localStorage.getItem('planogram.selectedStoreId')
      const name = window.localStorage.getItem('planogram.selectedStoreName')
      if (id) setSelectedStore(id, name || undefined)
    } catch {
      /* ignore */
    }
  }, [setSelectedStore])

  useEffect(() => {
    if (selectedStoreId) return
    let mounted = true
    ;(async () => {
      setLoadingBranches(true)
      try {
        const headers = await authHeaders()
        const res = await fetch('/api/locations/list?page=1&pageSize=200', { headers })
        const json = await res.json().catch(() => ({}))
        if (!mounted) return
        const list = json?.data?.locations ?? json?.data ?? []
        const mapped: Branch[] = (Array.isArray(list) ? list : []).map((b: any) => ({
          id: b.id,
          name: b.name ?? b.locationCode ?? b.id,
          address: b.address,
          storeType: b.storeType,
        }))
        setBranches(mapped)
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoadingBranches(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedStoreId])

  useEffect(() => {
    if (!selectedStoreId) {
      loadedStoreRef.current = null
      return
    }
    if (loadedStoreRef.current === selectedStoreId) return
    loadedStoreRef.current = selectedStoreId

    let mounted = true
    ;(async () => {
      setLoadingLayout(true)
      try {
        const result = await fetchStoreLayoutRacks(selectedStoreId)
        if (!mounted) return
        if (!result.success) {
          usePlanogramStore.setState((s) => ({ area: { ...s.area, racks: [] } }))
          return
        }

        const placed = gridPlaceRacks(result.racks, areaWidth, areaDepth)
        usePlanogramStore.setState((s) => ({ area: { ...s.area, racks: placed } }))
      } catch {
        loadedStoreRef.current = null
      } finally {
        if (mounted) setLoadingLayout(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedStoreId, areaWidth, areaDepth])

  if (selectedStoreId) {
    if (loadingLayout) {
      return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[120] px-4 py-2 bg-black/70 text-white text-sm rounded-lg flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Loading store layout...
        </div>
      )
    }
    return null
  }

  const filtered = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.address ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FiMapPin className="text-[#002952]" />
            Select a Store
          </h2>
          <p className="text-sm text-gray-500 mt-1">Choose a store to load its planogram layout.</p>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002952]/20 focus:border-[#002952] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {loadingBranches ? (
            <div className="py-16 flex flex-col items-center justify-center text-gray-400">
              <span className="w-8 h-8 border-4 border-[#002952]/20 border-t-[#002952] rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium">Loading stores...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm font-medium">No stores found.</div>
          ) : (
            filtered.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedStore(b.id, b.name)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-[#002952]/5 transition-colors flex items-start gap-3 group"
              >
                <span className="mt-0.5 w-9 h-9 rounded-lg bg-[#002952]/10 text-[#002952] flex items-center justify-center flex-shrink-0">
                  <FiMapPin size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-gray-900 group-hover:text-[#002952] truncate">{b.name}</span>
                  {b.address && <span className="block text-xs text-gray-500 truncate">{b.address}</span>}
                  {b.storeType && <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">{b.storeType}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
