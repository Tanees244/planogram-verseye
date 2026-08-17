// @ts-nocheck
'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect } from 'react'
import { SceneLeftPanel } from '@/components/SceneLeftPanel'
import { SceneTopBar } from '@/components/SceneTopBar'
import { PlanogramClipboardHotkeys } from '@/components/PlanogramClipboardHotkeys'
import { CustomRackBuilder } from '@/components/CustomRackBuilder'
import { ProductPlacementConfirm } from '@/components/ProductPlacementConfirm'
import { Spinner } from '@/components/Spinner'
import { usePlanogramStore } from '@/store/planogramStore'
import StoreLayout from '@/components/StoreLayout'
import { EditorDeepLinkHandler } from '@/components/EditorDeepLinkHandler'
import { GuidedOnboardingOverlay, hydrateGuidedModeFromStorage } from '@/components/GuidedOnboarding'

const Scene3D = dynamic(() => import('@/components/Scene3D').then((m) => ({ default: m.Scene3D })), {
  ssr: false,
})

export default function Home() {
  const isAddingRack = usePlanogramStore((s) => s.isAddingRack)
  const isAttachingProduct = usePlanogramStore((s) => s.isAttachingProduct)
  const isLoadingStoreLayout = usePlanogramStore((s) => s.isLoadingStoreLayout)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)

  useEffect(() => {
    hydrateGuidedModeFromStorage()
  }, [])

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <Suspense fallback={null}>
        <EditorDeepLinkHandler />
      </Suspense>
      <div className="absolute top-4 left-4 bottom-4 z-[100] min-h-0">
        <SceneLeftPanel />
      </div>
      <Scene3D />
      <StoreLayout />
      <CustomRackBuilder />
      <PlanogramClipboardHotkeys />
      <GuidedOnboardingOverlay />

      <SceneTopBar className="absolute top-4 right-4 z-[100]" />
      <div className="absolute bottom-24 right-4 z-[100]">
        <ProductPlacementConfirm />
      </div>
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
      {isAttachingProduct && !isAddingRack && (
        <div
          className="absolute inset-0 z-[200] flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-label="Attaching product"
        >
          <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/80 px-5 py-4 text-white shadow-2xl">
            <Spinner className="h-5 w-5 text-brand-light" />
            <div>
              <p className="text-sm font-semibold">Attaching product…</p>
              <p className="text-[11px] text-gray-300">Updating bin inventory and refreshing layout</p>
            </div>
          </div>
        </div>
      )}
      {isLoadingStoreLayout && !isAddingRack && !isAttachingProduct && (
        <div
          className="absolute inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
          aria-label="Loading store racks"
        >
          <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/80 px-5 py-4 text-white shadow-2xl min-w-[260px]">
            <Spinner className="h-5 w-5 text-brand-light" />
            <div>
              <p className="text-sm font-semibold">Loading store racks…</p>
              <p className="text-[11px] text-gray-300 truncate max-w-[240px]">
                {selectedStoreName
                  ? `Fetching fixtures for ${selectedStoreName}`
                  : 'Fetching fixtures, shelves, bins, and products'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}