'use client'

import { cn } from '@/lib/cn'
import {
  rackFaceUtilization,
  rowFaceUtilization,
  type FaceFillRow,
} from '@/utils/faceFill'

function barColor(percent: number): string {
  if (percent >= 95) return 'bg-emerald-500'
  if (percent >= 70) return 'bg-sky-500'
  if (percent >= 40) return 'bg-amber-500'
  return 'bg-red-400'
}

/** Compact linear face-meter utilization (Exact Face Fill / AI scoring basis). */
export function ShelfUtilizationMeter({
  row,
  rack,
  dark,
  className,
}: {
  row?: FaceFillRow | null
  rack?: { sides?: Array<{ rows?: FaceFillRow[] | null }> | null } | null
  dark?: boolean
  className?: string
}) {
  const u = row
    ? rowFaceUtilization(row)
    : rack
      ? rackFaceUtilization(rack)
      : null
  if (!u || !(u.availableM > 0)) return null

  const label = row ? 'Face utilization' : 'Shelf utilization'
  const pct = Math.round(u.percent)

  return (
    <div className={cn('w-full space-y-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide',
            dark ? 'text-gray-400' : 'text-gray-500',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'text-[11px] font-semibold tabular-nums',
            dark ? 'text-gray-200' : 'text-gray-800',
          )}
          title={`${u.occupiedM.toFixed(3)} m / ${u.availableM.toFixed(3)} m front face`}
        >
          {pct}%
        </span>
      </div>
      <div
        className={cn(
          'h-1.5 rounded-full overflow-hidden',
          dark ? 'bg-white/10' : 'bg-gray-200',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all', barColor(u.percent))}
          style={{ width: `${Math.max(2, Math.min(100, u.percent))}%` }}
        />
      </div>
    </div>
  )
}
