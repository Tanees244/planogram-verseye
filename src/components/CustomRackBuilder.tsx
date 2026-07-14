'use client'

import { useMemo, useState } from 'react'
import {
  FiX,
  FiLayers,
  FiMaximize2,
  FiBox,
  FiThermometer,
  FiPlus,
} from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  computeCustomRackDimensions,
  fitCustomRackToRetailWall,
  normalizeSectionSpans,
  resolveSectionSize,
  type CustomRackConfig,
  type CustomRackSection,
} from '@/components/fixtures/customRackTypes'
import { RETAIL_FIXTURE_HEIGHT } from '@/constants/warehouse'
import { cn } from '@/lib/cn'

function NumInput({
  label,
  value,
  step = 0.05,
  min = 0.05,
  max = 20,
  onChange,
}: {
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isFinite(v)) {
            onChange(min <= 0 ? 0 : min)
            return
          }
          onChange(v <= 0 && min <= 0 ? 0 : Math.max(v, min))
        }}
        className="mt-0.5 w-full px-2 py-1.5 text-xs rounded-lg bg-white/10 border border-white/15 text-white focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </label>
  )
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded border border-white/20 cursor-pointer bg-transparent"
      />
      <span className="text-[10px] text-gray-400">{label}</span>
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-white/30 bg-white/10 text-brand focus:ring-brand"
      />
      <span className="text-xs text-gray-200">{label}</span>
    </label>
  )
}

function sectionEnableDefaults(kind: 'header' | 'footer'): Partial<CustomRackSection> {
  if (kind === 'header') {
    return {
      enabled: true,
      height: 0.35,
      width: 0,
      depth: 0,
      protrusion: 0,
      color: '#2C5282',
      emissive: '#1A365D',
    }
  }
  return {
    enabled: true,
    height: 0.12,
    width: 0,
    depth: 0,
    protrusion: 0,
    color: '#ecf0f1',
    emissive: undefined,
  }
}

function SectionEditor({
  title,
  section,
  kind,
  showDepth = true,
  onChange,
  resolvedWidth,
  resolvedDepth,
}: {
  title: string
  section: CustomRackSection
  kind: 'header' | 'footer'
  showDepth?: boolean
  onChange: (patch: Partial<CustomRackSection>) => void
  resolvedWidth: number
  resolvedDepth: number
}) {
  return (
    <div className="space-y-2 p-2.5 rounded-lg bg-white/5 border border-white/10">
      <Toggle
        label={title}
        checked={section.enabled}
        onChange={(enabled) =>
          onChange(enabled ? sectionEnableDefaults(kind) : { enabled: false })
        }
      />
      {section.enabled && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] text-gray-500 leading-snug">
            One {kind} per rack · width/depth <span className="text-gray-400">0</span> = full span (
            {resolvedWidth.toFixed(2)} × {resolvedDepth.toFixed(2)} m)
          </p>
          <button
            type="button"
            onClick={() => onChange({ width: 0, depth: 0 })}
            className="text-[10px] px-2 py-1 rounded-md bg-white/10 border border-white/15 text-gray-300 hover:text-white hover:bg-white/15 transition-colors"
          >
            Reset to full rack span
          </button>
          <div className="grid grid-cols-2 gap-2">
            <NumInput
              label="Height (m)"
              value={section.height}
              min={0.05}
              max={kind === 'footer' ? 0.5 : 2}
              onChange={(height) => onChange({ height })}
            />
            <NumInput
              label="Width (m)"
              value={section.width}
              min={0}
              max={10}
              onChange={(width) => onChange({ width: width <= 0 ? 0 : width })}
            />
            {showDepth && (
              <NumInput
                label="Depth (m)"
                value={section.depth}
                min={0}
                max={5}
                onChange={(depth) => onChange({ depth: depth <= 0 ? 0 : depth })}
              />
            )}
            <div className={showDepth ? 'col-span-2' : ''}>
              <ColorInput label="Color" value={section.color} onChange={(color) => onChange({ color })} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function CustomRackBuilder() {
  const open = usePlanogramStore((s) => s.customRackBuilderOpen)
  const draft = usePlanogramStore((s) => s.customRackDraft)
  const editingId = usePlanogramStore((s) => s.editingCustomRackId)
  const setDraft = usePlanogramStore((s) => s.setCustomRackDraft)
  const close = usePlanogramStore((s) => s.closeCustomRackBuilder)
  const place = usePlanogramStore((s) => s.placeCustomRackFromBuilder)
  const updateRack = usePlanogramStore((s) => s.updateRackCustomConfig)
  const reloadStoreLayout = usePlanogramStore((s) => s.reloadStoreLayout)
  const saveRackLayout = usePlanogramStore((s) => s.saveRackLayoutToServer)
  const openBuilder = usePlanogramStore((s) => s.openCustomRackBuilder)
  const [saving, setSaving] = useState(false)

  const dims = useMemo(() => computeCustomRackDimensions(draft), [draft])

  if (!open) return null

  const patch = (p: Partial<CustomRackConfig>) =>
    setDraft((d) => normalizeSectionSpans({ ...d, ...p }))
  const patchHeader = (p: Partial<CustomRackSection>) =>
    setDraft((d) => normalizeSectionSpans({ ...d, header: { ...d.header, ...p } }))
  const patchFooter = (p: Partial<CustomRackSection>) =>
    setDraft((d) => normalizeSectionSpans({ ...d, footer: { ...d.footer, ...p } }))
  const patchWalls = (p: Partial<CustomRackConfig['walls']>) =>
    setDraft((d) => ({ ...d, walls: { ...d.walls, ...p } }))

  const handleSaveEdit = async () => {
    if (!editingId) return
    const normalized = normalizeSectionSpans(draft)
    const { exceptions } = updateRack(editingId, normalized)
    if (exceptions && exceptions.length > 0) {
      const summary = exceptions
        .slice(0, 5)
        .map((e) => e.message)
        .join('\n')
      window.alert(
        `Layout cascade adjusted nested sizes:\n\n${summary}${
          exceptions.length > 5 ? `\n…and ${exceptions.length - 5} more` : ''
        }`,
      )
    }
    setSaving(true)
    try {
      const res = await saveRackLayout(editingId, { reflowSkus: true })
      if (!res.success) {
        window.alert(res.message ?? 'Failed to save rack structure to server')
        return
      }
      await reloadStoreLayout()
      close()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute top-28 right-4 bottom-28 z-[105] w-[300px] flex flex-col rounded-xl border border-white/10 bg-black/85 backdrop-blur-md shadow-2xl text-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white shrink-0">
          <FiLayers size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white">Custom Rack Builder</h2>
          <p className="text-[10px] text-gray-400">Live 3D preview on floor</p>
        </div>
        <button
          type="button"
          onClick={close}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
        >
          <FiX size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Presets */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Templates</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'END_CAP' as const, label: 'End Cap', icon: FiBox },
                { id: 'REFRIGERATED' as const, label: 'Cooler', icon: FiThermometer },
                { id: 'CUSTOM' as const, label: 'Blank', icon: FiPlus },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => openBuilder(id, editingId ?? undefined)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg border text-[10px] font-medium transition-colors',
                  draft.preset === id
                    ? 'bg-brand/30 border-brand/50 text-white'
                    : 'border-white/10 text-gray-400 hover:bg-white/10 hover:text-white',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Outer dimensions */}
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <FiMaximize2 size={12} className="text-brand-light" />
              Outer dimensions
            </div>
            <button
              type="button"
              onClick={() => setDraft(fitCustomRackToRetailWall(draft))}
              className="text-[10px] px-2 py-1 rounded-md bg-brand/25 border border-brand/40 text-brand-light hover:bg-brand/35 transition-colors"
              title={`Scale to retail wall height (${RETAIL_FIXTURE_HEIGHT.toFixed(1)} m)`}
            >
              Fit wall height
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumInput label="Width" value={draft.outerWidth} onChange={(outerWidth) => patch({ outerWidth })} />
            <NumInput label="Depth" value={draft.outerDepth} onChange={(outerDepth) => patch({ outerDepth })} />
            <NumInput label="Height" value={draft.outerHeight} min={0.5} max={5} onChange={(outerHeight) => patch({ outerHeight })} />
          </div>
          <NumInput label="Wall thickness" value={draft.wallThickness} min={0.02} max={0.3} step={0.01} onChange={(wallThickness) => patch({ wallThickness })} />
        </div>

        {/* Inner dimensions (read-only) */}
        <div className="p-2.5 rounded-lg bg-brand/15 border border-brand/30">
          <p className="text-[10px] font-semibold text-brand-light uppercase tracking-wide mb-1">Inner cavity</p>
          <p className="text-xs text-white font-mono">
            {dims.innerWidth.toFixed(2)} × {dims.innerDepth.toFixed(2)} × {dims.innerHeight.toFixed(2)} m
          </p>
          <p className="text-[10px] text-emerald-300/90 mt-1 leading-snug">
            inner = outer − 2×wall · rows/bins rescale · facings clamp
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            Body {dims.bodyH.toFixed(2)}m
          </p>
          {draft.header.enabled && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              Header W×D×H {dims.headerW.toFixed(2)} × {dims.headerD.toFixed(2)} × {dims.headerH.toFixed(2)} m
            </p>
          )}
          {draft.footer.enabled && (
            <p className="text-[10px] text-gray-400">
              Footer W×D×H {dims.footerW.toFixed(2)} × {dims.footerD.toFixed(2)} × {dims.footerH.toFixed(2)} m
            </p>
          )}
        </div>

        <SectionEditor
          title="Header / fascia"
          kind="header"
          section={draft.header}
          showDepth
          resolvedWidth={resolveSectionSize(draft.header, draft.outerWidth, draft.outerDepth, 'header').width}
          resolvedDepth={resolveSectionSize(draft.header, draft.outerWidth, draft.outerDepth, 'header').depth}
          onChange={patchHeader}
        />
        <SectionEditor
          title="Footer / kick plate"
          kind="footer"
          section={draft.footer}
          showDepth
          resolvedWidth={resolveSectionSize(draft.footer, draft.outerWidth, draft.outerDepth, 'footer').width}
          resolvedDepth={resolveSectionSize(draft.footer, draft.outerWidth, draft.outerDepth, 'footer').depth}
          onChange={patchFooter}
        />

        {/* Walls — default 3-sided hollow bay (open front) */}
        <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-2">
          <p className="text-xs font-semibold text-white">Walls</p>
          <p className="text-[10px] text-gray-400 leading-snug">
            Hollow bay with back + side walls. Add rows after placing via + Add Row.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Back wall" checked={draft.walls.back} onChange={(back) => patchWalls({ back })} />
            <Toggle label="Left wall" checked={draft.walls.left} onChange={(left) => patchWalls({ left })} />
            <Toggle label="Right wall" checked={draft.walls.right} onChange={(right) => patchWalls({ right })} />
            <Toggle label="Glass front" checked={draft.walls.frontGlass} onChange={(frontGlass) => patchWalls({ frontGlass })} />
          </div>
        </div>

        <ColorInput label="Accent color" value={draft.accentColor} onChange={(accentColor) => patch({ accentColor })} />
      </div>

      {/* Footer actions */}
      <div className="shrink-0 p-3 border-t border-white/10 flex flex-col gap-2">
        {editingId ? (
          <>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save structure'}
            </button>
            <button
              type="button"
              onClick={close}
              className="w-full py-2 text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={place}
            className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors"
          >
            Place on floor
          </button>
        )}
      </div>
    </div>
  )
}
