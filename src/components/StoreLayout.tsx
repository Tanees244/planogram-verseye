"use client"

import { useEffect, useRef, useState } from 'react'
import { FiMapPin, FiSearch } from 'react-icons/fi'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/form'
import { usePlanogramStore } from '@/store/planogramStore'
import { authHeaders, fetchStoreLayoutRacks, placeRacksOnFloor } from '@/utils/storeLayoutLoader'

interface Branch {
  id: string
  name: string
  address?: string
  storeType?: string
}

export default function StoreLayout() {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)
  const setSelectedStore = usePlanogramStore((s) => s.setSelectedStore)
  const setIsLoadingStoreLayout = usePlanogramStore((s) => s.setIsLoadingStoreLayout)
  const areaWidth = usePlanogramStore((s) => s.area.width)
  const areaDepth = usePlanogramStore((s) => s.area.depth)

  const [branches, setBranches] = useState<Branch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [search, setSearch] = useState('')
  /** Last selected store — used to cancel “Change store” and close the picker. */
  const [dismissTo, setDismissTo] = useState<{ id: string; name: string | null } | null>(null)
  const restoredRef = useRef(false)
  const loadedStoreRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedStoreId) return
    setDismissTo({ id: selectedStoreId, name: selectedStoreName })
  }, [selectedStoreId, selectedStoreName])

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
      setIsLoadingStoreLayout(true)
      try {
        const result = await fetchStoreLayoutRacks(selectedStoreId)
        if (!mounted) return
        if (!result.success) {
          usePlanogramStore.setState((s) => ({ area: { ...s.area, racks: [] } }))
          return
        }
        const placed = placeRacksOnFloor(
          result.racks,
          areaWidth,
          areaDepth,
          selectedStoreId,
        )
        usePlanogramStore.setState((s) => ({ area: { ...s.area, racks: placed } }))
        // Drop the old local placement cache — load is API-only now.
        try {
          window.localStorage.removeItem('planogram.rackPlacements')
        } catch {
          /* ignore */
        }
      } catch {
        loadedStoreRef.current = null
      } finally {
        if (mounted) setIsLoadingStoreLayout(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [selectedStoreId, areaWidth, areaDepth, setIsLoadingStoreLayout])

  if (selectedStoreId) return null

  const filtered = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.address ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleClose = () => {
    if (!dismissTo) return
    setSelectedStore(dismissTo.id, dismissTo.name ?? undefined)
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title="Select Store"
      subtitle="Choose a store to load its planogram layout."
      maxWidth="lg"
      hideClose={!dismissTo}
    >
      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          autoFocus
          placeholder="Search stores…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="max-h-[50vh] overflow-auto -mx-1 px-1 space-y-1">
        {loadingBranches ? (
          <div className="py-12 flex flex-col items-center text-gray-400">
            <span className="w-8 h-8 border-4 border-brand/20 border-t-brand rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading stores…</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No stores found.</p>
        ) : (
          filtered.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedStore(b.id, b.name)}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-brand/5 border border-transparent hover:border-brand/10 transition-colors flex items-start gap-3 group"
            >
              <span className="mt-0.5 w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <FiMapPin size={16} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-gray-900 group-hover:text-brand truncate">{b.name}</span>
                {b.address && <span className="block text-xs text-gray-500 truncate">{b.address}</span>}
              </span>
            </button>
          ))
        )}
      </div>
    </Modal>
  )
}
