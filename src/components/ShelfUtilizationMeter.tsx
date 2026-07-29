'use client'

import { cn } from '@/lib/cn'
import { formatCm } from '@/utils/lengthUnits'
import {
  rackFaceUtilization,
  rowFaceUtilization,
  type FaceFillRow,
} from '@/utils/faceFill'
import type { ShelfFacingUtilization } from '@/types/shelfUtilization'

function barColor(percent: number, over?: boolean): string {
  if (over) return 'bg-red-500'
  if (percent >= 95) return 'bg-emerald-500'
  if (percent >= 70) return 'bg-sky-500'
  if (percent >= 40) return 'bg-amber-500'
  return 'bg-red-400'
}

type RowWithUtil = FaceFillRow & { utilization?: ShelfFacingUtilization | null }

/** Compact linear face-meter utilization (Exact Face Fill / API row.utilization). */
export function ShelfUtilizationMeter({
  row,
  rack,
  dark,
  className,
}: {
  row?: RowWithUtil | null
  rack?: { sides?: Array<{ rows?: FaceFillRow[] | null }> | null } | null
  dark?: boolean
  className?: string
}) {
  const api = row?.utilization ?? null

  // Prefer server utilization when present and calculable; never show fake 0% when canCalculate=false.
  if (api) {
    if (!api.canCalculate || api.status === 'dimensions_unavailable') {
      return (
        <div className={cn('w-full', className)}>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide',
              dark ? 'text-gray-500' : 'text-gray-400',
            )}
          >
            Face utilization unavailable
          </span>
        </div>
      )
    }
    const pct = Math.round(api.utilizationPercent)
    const label = 'Face utilization'
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
              api.isOverCapacity && 'text-red-400',
            )}
            title={`${formatCm(api.occupiedWidthMeters ?? 0, 1)} / ${formatCm(api.availableWidthMeters ?? 0, 1)} front face`}
          >
            {pct}%{api.isOverCapacity ? ' over' : ''}
          </span>
        </div>
        <div
          className={cn(
            'h-1.5 rounded-full overflow-hidden',
            dark ? 'bg-white/10' : 'bg-gray-200',
          )}
        >
          <div
            className={cn(
              'h-full rounded-full transition-all',
              barColor(api.utilizationPercent, api.isOverCapacity),
            )}
            style={{ width: `${Math.max(2, Math.min(100, api.utilizationPercent))}%` }}
          />
        </div>
      </div>
    )
  }

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
          title={`${formatCm(u.occupiedM, 1)} / ${formatCm(u.availableM, 1)} front face`}
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
