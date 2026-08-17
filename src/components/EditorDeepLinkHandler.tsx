'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { usePlanogramStore } from '@/store/planogramStore'
import { findRackByLinkId, parseEditorDeepLink } from '@/utils/editorDeepLink'

/**
 * Reads `?storeId=&rackId=` from the URL, loads the store, and selects the rack.
 */
export function EditorDeepLinkHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handledRef = useRef<string | null>(null)

  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const isLoadingStoreLayout = usePlanogramStore((s) => s.isLoadingStoreLayout)
  const racks = usePlanogramStore((s) => s.area.racks)
  const setSelectedStore = usePlanogramStore((s) => s.setSelectedStore)
  const setSelected = usePlanogramStore((s) => s.setSelected)
  const setRoofVisible = usePlanogramStore((s) => s.setRoofVisible)
  const setWallGuidesVisible = usePlanogramStore((s) => s.setWallGuidesVisible)

  useEffect(() => {
    const raw = searchParams.toString()
    if (!raw) return

    const link = parseEditorDeepLink(raw)
    if (!link) return

    const key = `${link.storeId}|${link.rackId ?? ''}|${link.shelfId ?? ''}`
    if (handledRef.current === key) return

    if (link.storeId !== selectedStoreId) {
      setSelectedStore(link.storeId, link.storeName ?? undefined)
      return
    }

    if (isLoadingStoreLayout) return

    handledRef.current = key

    if (link.rackId) {
      const rack = findRackByLinkId(racks, link.rackId)
      if (rack) {
        setSelected(rack.id, 'rack')
        setRoofVisible(false)
        setWallGuidesVisible(false)
        toast.success('Opened planogram in 3D editor')
      } else if (racks.length > 0) {
        toast.error('Rack not found in this store — it may have been removed.')
      }
    }

    router.replace('/', { scroll: false })
  }, [
    searchParams,
    selectedStoreId,
    isLoadingStoreLayout,
    racks,
    setSelectedStore,
    setSelected,
    setRoofVisible,
    setWallGuidesVisible,
    router,
  ])

  return null
}
