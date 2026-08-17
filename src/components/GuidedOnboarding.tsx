'use client'

import { FiCheck, FiChevronRight, FiHelpCircle, FiX } from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import { cn } from '@/lib/cn'

type GuidedStep = {
  id: string
  title: string
  hint: string
  done: boolean
}

export function GuidedOnboardingToggle({
  className,
}: {
  className?: string
}) {
  const guidedMode = usePlanogramStore((s) => s.guidedMode)
  const setGuidedMode = usePlanogramStore((s) => s.setGuidedMode)

  return (
    <button
      type="button"
      onClick={() => setGuidedMode(!guidedMode)}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors',
        guidedMode
          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
          : 'bg-white/10 text-white hover:bg-white/20',
        className,
      )}
      title="Step-by-step guide for new users"
    >
      <FiHelpCircle size={14} />
      {guidedMode ? 'Guide on' : 'Guide me'}
    </button>
  )
}

export function GuidedOnboardingOverlay() {
  const guidedMode = usePlanogramStore((s) => s.guidedMode)
  const setGuidedMode = usePlanogramStore((s) => s.setGuidedMode)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const racks = usePlanogramStore((s) => s.area.racks)
  const selectedType = usePlanogramStore((s) => s.selectedType)
  const selectedId = usePlanogramStore((s) => s.selectedId)

  const hasSku = racks.some((rack) =>
    rack.sides.some((side) =>
      side.rows.some((row) => row.bins.some((bin) => bin.products.length > 0)),
    ),
  )

  const steps: GuidedStep[] = [
    {
      id: 'store',
      title: 'Pick your store',
      hint: 'Use the Select Store dialog, or Scene & store → Change store.',
      done: Boolean(selectedStoreId),
    },
    {
      id: 'rack',
      title: 'Add or select a rack',
      hint: 'Open Fixtures on the left → drag a gondola onto the floor, or click an existing rack.',
      done:
        selectedType === 'rack' ||
        selectedType === 'row' ||
        selectedType === 'bin' ||
        selectedType === 'product' ||
        racks.length > 0,
    },
    {
      id: 'sku',
      title: 'Place products on a shelf',
      hint: 'Open Products tab → drag a SKU onto a shelf row.',
      done: hasSku,
    },
    {
      id: 'finish',
      title: 'Save or export',
      hint: 'Select the rack → Rows & racks → Save planogram, Export, or Copy to stores.',
      done: false,
    },
  ]

  const activeIndex = steps.findIndex((s) => !s.done)
  const active = activeIndex >= 0 ? steps[activeIndex] : steps[steps.length - 1]

  if (!guidedMode) return null

  return (
    <div className="absolute bottom-4 left-1/2 z-[250] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 pointer-events-auto">
      <div className="rounded-2xl border border-white/15 bg-[#0f172a]/95 text-white shadow-2xl backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Quick start guide
            </p>
            <p className="text-sm font-semibold mt-0.5">{active.title}</p>
          </div>
          <button
            type="button"
            onClick={() => setGuidedMode(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"
            aria-label="Close guide"
          >
            <FiX size={16} />
          </button>
        </div>

        <p className="px-4 py-3 text-sm text-gray-300 leading-snug">{active.hint}</p>

        <ol className="px-4 pb-4 flex flex-wrap gap-2">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border',
                step.done
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                  : i === activeIndex
                    ? 'border-sky-400/50 bg-sky-500/15 text-sky-100'
                    : 'border-white/10 bg-white/5 text-gray-400',
              )}
            >
              {step.done ? <FiCheck size={12} /> : <span>{i + 1}</span>}
              {step.title}
              {i < steps.length - 1 ? (
                <FiChevronRight size={10} className="opacity-40" />
              ) : null}
            </li>
          ))}
        </ol>

        {selectedId && selectedType ? (
          <p className="px-4 pb-3 text-[10px] text-gray-500">
            Selected: {selectedType} · simplified view (roof hidden)
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Call once on app mount to restore guided mode from localStorage. */
export function hydrateGuidedModeFromStorage() {
  if (typeof window === 'undefined') return
  try {
    const on = window.localStorage.getItem('planogram.guidedMode') === '1'
    usePlanogramStore.getState().setGuidedMode(on, { persist: false })
  } catch {
    /* ignore */
  }
}
