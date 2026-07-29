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
  FiColumns,
  FiX,
  FiSliders,
} from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  FIXTURE_LIBRARY,
  FIXTURE_PRESET_TYPES,
  type FixtureType,
} from '@/components/fixtures/types'
import { cn } from '@/lib/cn'
import { formatCmTriple, mToCmDisplay } from '@/utils/lengthUnits'
import {
  isRackNameConflictMessage,
  listCustomFixturePresets,
  suggestUniqueRackName,
  type CustomFixturePreset,
} from '@/utils/customFixturePresets'
import { PANEL_SHELL, PANEL_HEADER, PANEL_LIST_ITEM } from '@/lib/uiShell'
import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'

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

const shell = PANEL_SHELL

export function FixturePalette({
  fillHeight = false,
  embedded = false,
  filterQuery = '',
}: {
  fillHeight?: boolean
  /** When true, omit outer shell/header — parent provides chrome (SceneLeftPanel). */
  embedded?: boolean
  filterQuery?: string
}) {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const isPlacingRack = usePlanogramStore((s) => s.isPlacingRack)
  const placingFixtureType = usePlanogramStore((s) => s.placingFixtureType)
  const pendingRackParams = usePlanogramStore((s) => s.pendingRackParams)
  const areaRacks = usePlanogramStore((s) => s.area.racks)
  const startFixturePlacement = usePlanogramStore((s) => s.startFixturePlacement)
  const openCustomRackBuilder = usePlanogramStore((s) => s.openCustomRackBuilder)
  const setCustomRackDraft = usePlanogramStore((s) => s.setCustomRackDraft)
  const setPendingRackParams = usePlanogramStore((s) => s.setPendingRackParams)
  const placeCustomRackFromBuilder = usePlanogramStore((s) => s.placeCustomRackFromBuilder)
  const cancelFixturePlacement = usePlanogramStore((s) => s.cancelFixturePlacement)
  const addRackError = usePlanogramStore((s) => s.addRackError)
  const setAddRackError = usePlanogramStore((s) => s.setAddRackError)
  const setFixturePaletteCollapsed = usePlanogramStore((s) => s.setFixturePaletteCollapsed)
  const setFixtureDragActive = usePlanogramStore((s) => s.setFixtureDragActive)
  const wallGuidesVisible = usePlanogramStore((s) => s.wallGuidesVisible)
  const setWallGuidesVisible = usePlanogramStore((s) => s.setWallGuidesVisible)

  const [dragging, setDragging] = useState<FixtureType | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [customPresets, setCustomPresets] = useState<CustomFixturePreset[]>([])
  const [namePrompt, setNamePrompt] = useState<{
    preset: CustomFixturePreset | null
    /** Rename after server conflict while already placing. */
    renameOnly: boolean
    name: string
    error: string | null
  } | null>(null)

  useEffect(() => {
    setCustomPresets(listCustomFixturePresets())
  }, [collapsed, isPlacingRack])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY) === '1'
      setCollapsed(stored)
      setFixturePaletteCollapsed(stored)
    } catch {
      /* ignore */
    }
  }, [setFixturePaletteCollapsed])

  // After place fails with a name conflict, ask for a new name before retrying.
  useEffect(() => {
    if (!addRackError || !isRackNameConflictMessage(addRackError)) return
    if (!isPlacingRack || !pendingRackParams?.customConfig) return
    if (namePrompt) return
    const existing = areaRacks.map(
      (r) => r.rackName ?? r.blueprintName ?? r.displayName ?? r.rackCode,
    )
    const base = pendingRackParams.rackName?.trim() || 'Custom rack'
    setNamePrompt({
      preset: null,
      renameOnly: true,
      name: suggestUniqueRackName(base, existing),
      error: addRackError,
    })
  }, [addRackError, isPlacingRack, pendingRackParams, areaRacks, namePrompt])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    setFixturePaletteCollapsed(next)
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const openPresetNamePrompt = (preset: CustomFixturePreset) => {
    if (!selectedStoreId) return
    const existing = areaRacks.map(
      (r) => r.rackName ?? r.blueprintName ?? r.displayName ?? r.rackCode,
    )
    setNamePrompt({
      preset,
      renameOnly: false,
      name: suggestUniqueRackName(preset.name, existing),
      error: null,
    })
  }

  const confirmPresetName = () => {
    if (!namePrompt) return
    const name = namePrompt.name.trim()
    if (!name) {
      setNamePrompt({ ...namePrompt, error: 'Rack name is required' })
      return
    }
    const taken = areaRacks.some((r) => {
      const n = (r.rackName ?? r.blueprintName ?? r.displayName ?? '').trim().toLowerCase()
      return n === name.toLowerCase()
    })
    if (taken) {
      setNamePrompt({
        ...namePrompt,
        error: 'That name is already used in this store. Choose another.',
      })
      return
    }

    if (namePrompt.renameOnly) {
      if (pendingRackParams) {
        setPendingRackParams({ ...pendingRackParams, rackName: name })
      }
      setAddRackError(null)
      setNamePrompt(null)
      return
    }

    if (!namePrompt.preset) return
    setCustomRackDraft(namePrompt.preset.config)
    placeCustomRackFromBuilder(name)
    setNamePrompt(null)
  }

  const onDragStart = (type: FixtureType, e: React.DragEvent) => {
    if (!selectedStoreId) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData(DRAG_MIME, type)
    e.dataTransfer.effectAllowed = 'copy'
    setDragging(type)
    setFixtureDragActive(true, type)
  }

  const onDragEnd = () => {
    setDragging(null)
    setFixtureDragActive(false)
  }

  if (collapsed && !embedded) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        className={cn(shell, 'relative flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 text-left')}
        title="Expand fixture library"
      >
        <FiChevronRight size={16} className="text-sky-200" />
        <span className="text-xs font-semibold text-white">Fixtures</span>
      </button>
    )
  }

  const q = filterQuery.trim().toLowerCase()
  const visiblePresets = q
    ? customPresets.filter((p) => p.name.toLowerCase().includes(q))
    : customPresets
  const visibleTypes = q
    ? FIXTURE_PRESET_TYPES.filter((type) =>
        FIXTURE_LIBRARY[type].label.toLowerCase().includes(q),
      )
    : FIXTURE_PRESET_TYPES
  const showBuildCustom =
    !q || 'build custom rack'.includes(q) || q.includes('custom') || q.includes('build')

  return (
    <>
      <div
        className={cn(
          !embedded && shell,
          'flex flex-col overflow-hidden',
          fillHeight || embedded ? 'h-full min-h-0' : 'max-h-[min(70vh,560px)]',
        )}
      >
        {!embedded && (
        <div className={cn(PANEL_HEADER, 'flex items-center justify-between gap-2')}>
          <span className="text-xs font-semibold text-white tracking-wide">Fixture library</span>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1 rounded-md hover:bg-white/10 text-gray-300 hover:text-white"
            title="Collapse"
          >
            <FiChevronLeft size={14} />
          </button>
        </div>
        )}

        {isPlacingRack && placingFixtureType && (
          <div className="mx-2 mt-2 px-2.5 py-2 rounded-lg bg-brand/25 border border-brand/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-[11px]">
                <p className="font-semibold text-sky-100 truncate">
                  {FIXTURE_LIBRARY[placingFixtureType].label}
                </p>
                <p className="text-gray-300 mt-0.5">
                  {pendingRackParams
                    ? `${mToCmDisplay(pendingRackParams.width, 0)}×${mToCmDisplay(pendingRackParams.depth, 0)} cm — click floor`
                    : 'Click floor'}
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

        {addRackError && !namePrompt && (
          <div className="mx-2 mt-1.5 px-2 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-200 text-[11px]">
            {addRackError}
            {isRackNameConflictMessage(addRackError) && pendingRackParams?.customConfig && (
              <button
                type="button"
                className="mt-1 block underline text-red-100 hover:text-white"
                onClick={() => {
                  const existing = areaRacks.map(
                    (r) => r.rackName ?? r.blueprintName ?? r.displayName ?? r.rackCode,
                  )
                  const base = pendingRackParams.rackName?.trim() || 'Custom rack'
                  setNamePrompt({
                    preset: null,
                    renameOnly: true,
                    name: suggestUniqueRackName(base, existing),
                    error: addRackError,
                  })
                }}
              >
                Choose a different name
              </button>
            )}
          </div>
        )}

        <div
          className={cn(
            'p-2 space-y-1.5 overflow-y-auto scrollbar-thin min-h-0',
            (fillHeight || embedded) && 'flex-1',
          )}
        >
          <button
            type="button"
            onClick={() => setWallGuidesVisible(!wallGuidesVisible)}
            className={cn(
              'w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left',
              wallGuidesVisible
                ? 'border-sky-400/50 bg-sky-500/20 shadow-md shadow-sky-900/20'
                : 'border-white/10 bg-white/[0.04] hover:bg-white/10 hover:border-white/15',
            )}
            aria-pressed={wallGuidesVisible}
            title="Show one-sided wall-bay guides along the walls (not clickable)"
          >
            <span
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-xl shrink-0',
                wallGuidesVisible ? 'bg-sky-500 text-white' : 'bg-white/10 text-sky-200',
              )}
            >
              <FiColumns size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-white block">Wall rack guides</span>
              <span className="text-[10px] text-gray-400">
                One-sided wall bays with sample SKUs · not clickable
              </span>
            </div>
            <span
              className={cn(
                'shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold',
                wallGuidesVisible
                  ? 'bg-brand/40 border-brand/50 text-white'
                  : 'bg-black/35 border-white/10 text-gray-400',
              )}
            >
              {wallGuidesVisible ? 'On' : 'Off'}
            </span>
          </button>

          {showBuildCustom && (
          <button
            type="button"
            onClick={() => selectedStoreId && openCustomRackBuilder('CUSTOM')}
            disabled={!selectedStoreId}
            className={cn(
              'w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left',
              'border-sky-400/40 bg-gradient-to-r from-brand/40 to-sky-600/25 hover:from-brand/50 hover:to-sky-500/30 shadow-lg shadow-brand/20',
              !selectedStoreId && 'opacity-45 cursor-not-allowed',
            )}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand text-white shrink-0 shadow-md shadow-brand/40">
              <FiSliders size={15} />
            </span>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-white block">Build Custom Rack</span>
              <span className="text-[10px] text-sky-100/80">Configure in modal · confirm to place</span>
            </div>
          </button>
          )}

          {visiblePresets.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-1 py-0.5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">My custom</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              {visiblePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!selectedStoreId}
                  onClick={() => openPresetNamePrompt(preset)}
                  className={cn(
                    'w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left',
                    'border-transparent hover:bg-white/10 hover:border-white/10',
                    !selectedStoreId && 'opacity-45 cursor-not-allowed',
                  )}
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-600/30 text-emerald-200 shrink-0">
                    <FiStar size={14} />
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">{preset.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {`${mToCmDisplay(preset.config.outerWidth, 0)}×${mToCmDisplay(preset.config.outerDepth, 0)} cm custom`}
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}

          {visibleTypes.length > 0 && (
          <div className="flex items-center gap-2 px-1 py-0.5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">Presets</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          )}

          {visibleTypes.map((type) => {
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
                  PANEL_LIST_ITEM,
                  'hover:bg-sky-500/15 hover:border-sky-400/35',
                  active &&
                    'bg-brand/30 border-brand/50 shadow-lg shadow-brand/20 ring-2 ring-brand/50 -translate-y-0.5',
                  isDragging && 'opacity-40 scale-95 ring-2 ring-sky-300/60',
                  !selectedStoreId && 'opacity-45 cursor-not-allowed hover:translate-y-0 hover:shadow-none',
                )}
                title={def.description}
              >
                <div
                  className={cn(
                    'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center',
                    active
                      ? 'bg-brand text-white shadow-md shadow-brand/40'
                      : 'bg-gradient-to-br from-sky-500/25 to-white/10 text-sky-200',
                  )}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-white truncate">{def.label}</span>
                    <FiMove size={10} className="text-sky-300/70 shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {formatCmTriple(def.defaultWidth, def.defaultDepth, def.defaultHeight)}
                    {def.defaultSided === 'two' ? ' · 2-sided' : ''} · shelves ready
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        open={Boolean(namePrompt)}
        onClose={() => setNamePrompt(null)}
        title={namePrompt?.renameOnly ? 'Name already in use' : 'Name this rack'}
        subtitle={
          namePrompt?.renameOnly
            ? 'Enter a unique rack name, then click the floor again to place.'
            : `From preset “${namePrompt?.preset?.name ?? ''}” — name must be unique in this store.`
        }
        maxWidth="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setNamePrompt(null)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={confirmPresetName}>
              {namePrompt?.renameOnly ? 'Use this name' : 'Place with this name'}
            </Btn>
          </>
        }
      >
        <FormField
          label="Rack name"
          required
          error={namePrompt?.error}
          hint="Display name only — rack code is generated by the server."
        >
          <Input
            autoFocus
            value={namePrompt?.name ?? ''}
            onChange={(e) =>
              setNamePrompt((prev) =>
                prev ? { ...prev, name: e.target.value, error: null } : prev,
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmPresetName()
              }
            }}
            placeholder="e.g. Dairy Cooler A"
            maxLength={120}
          />
        </FormField>
      </Modal>
    </>
  )
}

export { DRAG_MIME }
