'use client'

import { cn } from '@/lib/cn'
import {
  rowFaceFillState,
  type FaceFillRow,
  type RowFaceFillState,
} from '@/utils/faceFill'

const LABELS: Record<RowFaceFillState, string> = {
  complete: 'Face fill complete',
  row_gap: 'Unused shelf width',
  bin_gap: 'Add facings',
  overfill: 'Overfilled',
  empty: 'Empty shelf',
}

const STYLES: Record<RowFaceFillState, string> = {
  complete: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  row_gap: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  bin_gap: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  overfill: 'bg-red-500/15 text-red-300 border-red-500/30',
  empty: 'bg-white/5 text-gray-400 border-white/10',
}

/** Compact face-fill status for a row (Exact Face Fill rules). */
export function RowFaceFillChip({
  row,
  rack,
  className,
}: {
  row: FaceFillRow
  rack?: { inner?: { width?: number | null } | null; width?: number | null } | null
  className?: string
}) {
  const { state, remainingSpanM } = rowFaceFillState(row, rack)
  const extra =
    state === 'row_gap' && remainingSpanM > 0
      ? ` · ${(remainingSpanM * 100).toFixed(0)} cm free`
      : ''

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
        STYLES[state],
        className,
      )}
      title="Front face fill (linear facings across the shelf)"
    >
      {LABELS[state]}
      {extra}
    </span>
  )
}
