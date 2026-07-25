'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  FiChevronDown,
  FiClipboard,
  FiCopy,
  FiDownload,
  FiMousePointer,
  FiMove,
  FiSettings,
  FiUpload,
  FiX,
  FiZoomIn,
} from 'react-icons/fi'
import { RoofToggle, RoofHint } from '@/components/ui/RoofToggle'
import { usePlanogramStore } from '@/store/planogramStore'
import { cn } from '@/lib/cn'
import { PANEL_SHELL } from '@/lib/uiShell'
import { usePlanogramExport } from '@/utils/planogramExport'

const OPEN_KEY = 'planogram.sceneTopBarOpen'

const shell = PANEL_SHELL

const menuBtn =
  'w-full px-2.5 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors'

const CONTROL_ROWS: {
  action: string
  keys: string
  icon?: 'move' | 'zoom' | 'click' | 'copy' | 'paste'
}[] = [
  { action: 'Orbit', keys: 'Left-drag', icon: 'move' },
  { action: 'Pan', keys: 'Right-drag', icon: 'move' },
  { action: 'Zoom', keys: 'Scroll', icon: 'zoom' },
  { action: 'Focus object', keys: 'Click', icon: 'click' },
  { action: 'Select row', keys: 'Shift + click bin', icon: 'click' },
  { action: 'Copy', keys: 'Ctrl + C', icon: 'copy' },
  { action: 'Paste', keys: 'Ctrl + V', icon: 'paste' },
]

function ControlIcon({ kind }: { kind?: 'move' | 'zoom' | 'click' | 'copy' | 'paste' }) {
  const cls = 'shrink-0 text-brand-light/90'
  if (kind === 'zoom') return <FiZoomIn size={12} className={cls} />
  if (kind === 'click') return <FiMousePointer size={12} className={cls} />
  if (kind === 'copy') return <FiCopy size={12} className={cls} />
  if (kind === 'paste') return <FiClipboard size={12} className={cls} />
  return <FiMove size={12} className={cls} />
}

/** Compact camera / selection cheat-sheet for the Scene & store panel. */
function ControlsPanel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-full rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/10">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Controls
        </span>
      </div>
      <ul className="divide-y divide-white/5">
        {CONTROL_ROWS.map((row) => (
          <li key={row.action} className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]">
            <ControlIcon kind={row.icon} />
            <span className="flex-1 min-w-0 text-gray-200 font-medium">{row.action}</span>
            <kbd className="shrink-0 px-1.5 py-0.5 rounded-md bg-black/35 border border-white/10 text-[10px] font-semibold text-gray-300">
              {row.keys}
            </kbd>
          </li>
        ))}
      </ul>
      <p className="px-2.5 py-1.5 text-[10px] leading-snug text-gray-500 border-t border-white/10">
        Dense bins: up to 24 front facings render as full 3D models; deeper units stay as boxes.
      </p>
    </div>
  )
}

function StoreExportMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { exportStore, exportStoreCsv, exportStoreXlsx, exportSceneImage, exportStorePdf, exportStorePptx } =
    usePlanogramExport()

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const run = (action: () => void | Promise<void>) => {
    setOpen(false)
    void action()
  }

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(menuBtn, 'inline-flex items-center justify-between gap-2')}
        aria-expanded={open}
        title="Export store in a chosen format"
      >
        <span className="inline-flex items-center gap-2">
          <FiDownload size={14} />
          Export
        </span>
        <FiChevronDown
          size={14}
          className={cn('shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-0.5 p-1 rounded-xl bg-[#1e293b] border border-slate-600 shadow-xl z-[110]">
          {(
            [
              { label: 'PLM', onClick: () => exportStore('plm') },
              { label: 'PSA', onClick: () => exportStore('psa') },
              { label: 'Excel (.xlsx)', onClick: () => void exportStoreXlsx() },
              { label: 'CSV', onClick: () => exportStoreCsv() },
              { label: 'PNG', onClick: () => exportSceneImage() },
              { label: 'PDF', onClick: () => void exportStorePdf() },
              { label: 'PowerPoint', onClick: () => void exportStorePptx() },
            ] as const
          ).map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => run(item.onClick)}
              className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-gray-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              {item.label}
            </button>
          ))}
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
            'flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 text-left hover:bg-[#152033] hover:border-slate-500 transition-all duration-200 group hover:-translate-y-0.5',
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
          <FiChevronDown
            size={16}
            className="text-gray-400 shrink-0 group-hover:text-white transition-colors"
          />
          {(isLoadingStoreLayout || isSavingLayout) && (
            <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse shrink-0" />
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-end gap-2', className)}>
      <div
        className={cn(
          shell,
          'w-[260px] flex flex-col gap-2 p-2.5 text-gray-100 animate-in fade-in slide-in-from-top-2 duration-200',
        )}
      >
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
        <ControlsPanel />
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
                      : selectedStoreName || 'Store'}
                </span>
              </div>
              {!isLoadingStoreLayout && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedStore(null)}
                    className={menuBtn}
                  >
                    Change store
                  </button>
                  <StoreExportMenu />
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
