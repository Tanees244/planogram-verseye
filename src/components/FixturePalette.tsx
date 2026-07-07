'use client'

import { useEffect, useState } from 'react'
import {
  FiBox,
  FiGrid,
  FiLayers,
  FiShoppingBag,
  FiArchive,
  FiPackage,
  FiThermometer,
  FiCloudSnow,
  FiCreditCard,
  FiStar,
  FiMove,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiSliders,
} from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  FIXTURE_LIBRARY,
  FIXTURE_TYPES,
  type FixtureType,
} from '@/components/fixtures/types'
import { cn } from '@/lib/cn'

const FIXTURE_ICONS: Record<FixtureType, React.ComponentType<{ size?: number; className?: string }>> = {
  GONDOLA: FiGrid,
  WALL_BAY: FiLayers,
  END_CAP: FiBox,
  DUMP_BIN: FiArchive,
  PALLET_DISPLAY: FiPackage,
  REFRIGERATED: FiThermometer,
  FREEZER: FiCloudSnow,
  PEGBOARD: FiShoppingBag,
  CHECKOUT: FiCreditCard,
  PROMOTIONAL: FiStar,
  CUSTOM: FiSliders,
}

const DRAG_MIME = 'application/fixture-type'
const COLLAPSE_KEY = 'planogram.fixturePaletteCollapsed'

const shell = 'rounded-xl shadow-lg backdrop-blur-sm bg-black/70 border border-white/10'

export function FixturePalette() {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const isPlacingRack = usePlanogramStore((s) => s.isPlacingRack)
  const placingFixtureType = usePlanogramStore((s) => s.placingFixtureType)
  const pendingRackParams = usePlanogramStore((s) => s.pendingRackParams)
  const startFixturePlacement = usePlanogramStore((s) => s.startFixturePlacement)
  const openCustomRackBuilder = usePlanogramStore((s) => s.openCustomRackBuilder)
  const cancelFixturePlacement = usePlanogramStore((s) => s.cancelFixturePlacement)
  const addRackError = usePlanogramStore((s) => s.addRackError)

  const [dragging, setDragging] = useState<FixtureType | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const onDragStart = (type: FixtureType, e: React.DragEvent) => {
    if (!selectedStoreId) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData(DRAG_MIME, type)
    e.dataTransfer.effectAllowed = 'copy'
    setDragging(type)
  }

  const onDragEnd = () => setDragging(null)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        className={cn(
          shell,
          'relative flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 text-left',
          'hover:bg-black/85 transition-colors group',
        )}
        title="Open fixture library"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand/20 text-brand-light group-hover:bg-brand/30 transition-colors">
          <FiGrid size={16} />
        </span>
        <span className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-white leading-tight">Fixtures</span>
          <span className="text-[10px] text-gray-400 leading-tight">
            {FIXTURE_TYPES.length} types · click to open
          </span>
        </span>
        <FiChevronRight size={16} className="text-gray-400 shrink-0 ml-1 group-hover:text-white transition-colors" />
        {isPlacingRack && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black/70 animate-pulse" />
        )}
      </button>
    )
  }

  return (
    <div className={cn(shell, 'relative w-full flex-1 min-h-0 flex flex-col overflow-hidden text-gray-100')}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0 bg-black/30">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white shrink-0">
          <FiGrid size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white leading-tight">Fixture Library</h2>
          <p className="text-[10px] text-gray-400 truncate">Drag or click, then place on floor</p>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Hide panel"
        >
          <FiChevronLeft size={16} />
        </button>
      </div>

      {!selectedStoreId && (
        <div className="mx-2.5 mt-2.5 px-2.5 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-100 text-[11px] leading-snug">
          Select a store before placing fixtures
        </div>
      )}

      {isPlacingRack && placingFixtureType && (
        <div className="mx-2.5 mt-2.5 px-2.5 py-2 rounded-lg bg-brand/20 border border-brand/35 text-[11px]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">
                {FIXTURE_LIBRARY[placingFixtureType].label}
              </p>
              <p className="text-gray-300 mt-0.5">
                {pendingRackParams?.width}×{pendingRackParams?.depth}m — click floor
              </p>
            </div>
            <button
              type="button"
              onClick={cancelFixturePlacement}
              className="shrink-0 p-1 rounded-md hover:bg-white/10 text-gray-300 hover:text-white"
              title="Cancel placement"
            >
              <FiX size={14} />
            </button>
          </div>
        </div>
      )}

      {addRackError && (
        <div className="mx-2.5 mt-2 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-200 text-[11px]">
          {addRackError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
        <button
          type="button"
          onClick={() => selectedStoreId && openCustomRackBuilder('CUSTOM')}
          disabled={!selectedStoreId}
          className={cn(
            'w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left',
            'border-brand/40 bg-brand/20 hover:bg-brand/30',
            !selectedStoreId && 'opacity-45 cursor-not-allowed',
          )}
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white shrink-0">
            <FiSliders size={15} />
          </span>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-white block">Build Custom Rack</span>
            <span className="text-[10px] text-gray-400">Header · footer · walls · live preview</span>
          </div>
        </button>

        <div className="flex items-center gap-2 px-1 py-0.5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Presets</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {FIXTURE_TYPES.filter((t) => t !== 'CUSTOM').map((type) => {
          const def = FIXTURE_LIBRARY[type]
          const Icon = FIXTURE_ICONS[type]
          const active = placingFixtureType === type
          const isDragging = dragging === type

          return (
            <div
              key={type}
              draggable={Boolean(selectedStoreId)}
              onDragStart={(e) => onDragStart(type, e)}
              onDragEnd={onDragEnd}
              onClick={() => {
                if (!selectedStoreId) return
                startFixturePlacement(type)
              }}
              className={cn(
                'flex items-center gap-2.5 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all',
                'border-transparent hover:bg-white/10 hover:border-white/10',
                active && 'bg-brand/25 border-brand/40',
                isDragging && 'opacity-50',
                !selectedStoreId && 'opacity-45 cursor-not-allowed',
              )}
            >
              <div
                className={cn(
                  'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                  active ? 'bg-brand text-white' : 'bg-white/10 text-gray-300',
                )}
              >
                <Icon size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-white truncate">{def.label}</span>
                  <FiMove size={10} className="text-gray-500 shrink-0 opacity-60" />
                </div>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                  {def.defaultWidth}×{def.defaultDepth}m
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { DRAG_MIME }
