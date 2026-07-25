'use client'

import { FiHome, FiLayers } from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import { cn } from '@/lib/cn'

export function RoofToggle({
  className,
  dark,
  embedded,
}: {
  className?: string
  dark?: boolean
  embedded?: boolean
}) {
  const roofVisible = usePlanogramStore((s) => s.roofVisible)
  const setRoofVisible = usePlanogramStore((s) => s.setRoofVisible)

  return (
    <button
      type="button"
      onClick={() => setRoofVisible(!roofVisible)}
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
        embedded
          ? cn(
              'w-full text-left',
              roofVisible
                ? 'bg-brand/25 text-white border border-brand/40 hover:bg-brand/35'
                : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent',
            )
          : cn(
              'shadow-lg border',
              dark
                ? 'bg-[#111827] border-slate-600 text-gray-200 hover:bg-[#152033]'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
            ),
        className,
      )}
      title={
        roofVisible
          ? 'Click the roof in 3D, or use this button to open the building'
          : 'Show building roof'
      }
      aria-pressed={!roofVisible}
    >
      <span className="inline-flex items-center gap-1.5">
        {roofVisible ? <FiLayers size={16} /> : <FiHome size={16} />}
        {roofVisible ? 'Open Building' : 'Show Roof'}
      </span>
      <span
        className={cn(
          'h-2 w-2 rounded-full transition-colors',
          roofVisible ? 'bg-amber-300 animate-pulse' : 'bg-emerald-400',
        )}
      />
    </button>
  )
}

export function RoofHint() {
  const roofVisible = usePlanogramStore((s) => s.roofVisible)
  if (!roofVisible) return null

  return (
    <div className="px-3.5 py-2 rounded-xl bg-[#152033] text-brand-light text-[12px] font-medium shadow-lg border border-brand/35 animate-in fade-in slide-in-from-top-1 duration-200">
      Click the roof to enter the store
    </div>
  )
}
