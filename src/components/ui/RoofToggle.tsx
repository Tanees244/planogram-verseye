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
        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
        embedded
          ? 'text-gray-300 hover:text-white hover:bg-white/10'
          : cn(
              'shadow-lg border',
              dark
                ? 'bg-[#111827] border-slate-600 text-gray-200 hover:bg-[#152033]'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
            ),
        className,
      )}
      title={roofVisible ? 'Click the roof in 3D, or use this button to open the building' : 'Show building roof'}
    >
      {roofVisible ? (
        <>
          <FiLayers size={16} />
          Open Building
        </>
      ) : (
        <>
          <FiHome size={16} />
          Show Roof
        </>
      )}
    </button>
  )
}

export function RoofHint() {
  const roofVisible = usePlanogramStore((s) => s.roofVisible)
  if (!roofVisible) return null

  return (
    <div className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium shadow-lg border border-brand-dark animate-pulse">
      Click the roof to enter and edit your layout
    </div>
  )
}
