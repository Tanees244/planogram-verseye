'use client'

import {
  PRODUCT_SIZE_PRESETS,
  type ProductSizePreset,
} from '@/constants/dimensions'
import { cn } from '@/lib/cn'
import { formatCmTriple } from '@/utils/lengthUnits'

export function ProductSizePresetPicker({
  onSelect,
  className,
  dark = false,
}: {
  onSelect: (preset: ProductSizePreset) => void
  className?: string
  dark?: boolean
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          dark ? 'text-gray-400' : 'text-gray-500',
        )}
      >
        Size presets
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PRODUCT_SIZE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            title={formatCmTriple(preset.width, preset.depth, preset.height)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors',
              dark
                ? 'border-white/15 text-gray-200 hover:bg-white/10 hover:border-emerald-400/40'
                : 'border-gray-200 text-gray-700 hover:bg-[#2C5282]/5 hover:border-[#2C5282]/40 hover:text-[#2C5282]',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
