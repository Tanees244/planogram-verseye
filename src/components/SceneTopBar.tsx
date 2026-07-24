'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FiChevronDown, FiSettings, FiUpload, FiX } from 'react-icons/fi'
import { RoofToggle, RoofHint } from '@/components/ui/RoofToggle'
import { usePlanogramStore } from '@/store/planogramStore'
import { cn } from '@/lib/cn'
import { PANEL_SHELL } from '@/lib/uiShell'
import { usePlanogramExport } from '@/utils/planogramExport'

const OPEN_KEY = 'planogram.sceneTopBarOpen'

const MOVE_HINT =
  'Move: Left-drag orbit · Right-drag pan · Scroll zoom · Click objects to focus · Shift+click bin/product → row · Dense bins: only front facings show full 3D models (rest are boxes) for performance'

const shell = PANEL_SHELL

function ControlsButton({ vertical }: { vertical?: boolean }) {
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
    <div className={cn('relative', vertical && 'w-full')} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'rounded-lg text-sm font-semibold transition-colors text-gray-300 hover:text-white hover:bg-white/10',
          vertical ? 'w-full px-3 py-2 text-left' : 'px-3 py-2',
        )}
        title="View controls"
      >
        Controls
      </button>
      {open && (
        <div
          className={cn(
            'px-4 py-3 bg-[#1e293b] text-gray-200 rounded-xl text-sm border border-slate-600 shadow-xl z-[110]',
            vertical ? 'mt-2 w-full' : 'absolute top-full right-0 mt-2 min-w-[320px]',
          )}
        >
          {MOVE_HINT}
        </div>
      )}
    </div>
  )
}

/** Unified top-right menu: scene controls + store actions (collapsed by default, opens vertically). */
export function SceneTopBar({ className }: { className?: string }) {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)
  const isLoadingStoreLayout = usePlanogramStore((s) => s.isLoadingStoreLayout)
  const isSavingLayout = usePlanogramStore((s) => s.isSavingLayout)
  const setSelectedStore = usePlanogramStore((s) => s.setSelectedStore)
  const { exportStore, exportStoreCsv, exportSceneImage, exportStorePdf, exportStorePptx } =
    usePlanogramExport()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(OPEN_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  const toggleOpen = (next: boolean) => {
    setOpen(next)
    try {
      window.localStorage.setItem(OPEN_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  if (!open) {
    return (
      <div className={cn('flex flex-col items-end gap-2', className)}>
        <button
          type="button"
          onClick={() => toggleOpen(true)}
          className={cn(
            shell,
            'flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 text-left hover:bg-[#152033] transition-colors group',
          )}
          title="Open scene & store menu"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-gray-200 group-hover:bg-white/15 transition-colors">
            <FiSettings size={16} />
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-white leading-tight">Scene & store</span>
            <span className="text-[10px] text-gray-400 leading-tight truncate max-w-[140px]">
              {selectedStoreName || 'Roof · import · export'}
            </span>
          </span>
          <FiChevronDown size={16} className="text-gray-400 shrink-0 group-hover:text-white transition-colors" />
          {(isLoadingStoreLayout || isSavingLayout) && (
            <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse shrink-0" />
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-end gap-2', className)}>
      <div className={cn(shell, 'w-[248px] flex flex-col gap-2 p-2.5 text-gray-100')}>
        <div className="flex items-center justify-between gap-2 px-0.5 pb-0.5 border-b border-white/10 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-light/90">
            Scene & store
          </span>
          <button
            type="button"
            onClick={() => toggleOpen(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Close menu"
            aria-label="Close scene menu"
          >
            <FiX size={14} />
          </button>
        </div>

        <RoofToggle dark embedded className="w-full justify-center" />
        <ControlsButton vertical />
        <Link
          href="/import"
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Import a PLM or PSA planogram"
        >
          <FiUpload size={14} />
          Import planogram
        </Link>

        {selectedStoreId && (
          <>
            <span className="h-px bg-white/10 my-0.5" aria-hidden />
            <div className="flex flex-col gap-2 px-0.5">
              <div className="flex items-center gap-2 min-w-0">
                {(isLoadingStoreLayout || isSavingLayout) && (
                  <span className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin shrink-0" />
                )}
                <span className="text-sm font-semibold truncate">
                  {isLoadingStoreLayout
                    ? 'Loading…'
                    : isSavingLayout
                      ? 'Saving…'
                      : (selectedStoreName || 'Store')}
                </span>
              </div>
              {!isLoadingStoreLayout && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedStore(null)}
                    className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Change store
                  </button>
                  <button
                    type="button"
                    onClick={() => exportStore('plm')}
                    className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Export store PLM
                  </button>
                  <button
                    type="button"
                    onClick={() => exportStore('psa')}
                    className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Export store PSA
                  </button>
                  <button
                    type="button"
                    onClick={() => exportStoreCsv()}
                    className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Export CSV (Excel)
                  </button>
                  <button
                    type="button"
                    onClick={() => exportSceneImage()}
                    className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Export PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportStorePdf()}
                    className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportStorePptx()}
                    className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Export PowerPoint
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <RoofHint />
    </div>
  )
}
