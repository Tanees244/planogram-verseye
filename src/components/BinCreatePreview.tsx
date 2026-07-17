'use client'

import { cn } from '@/lib/cn'

/** Schematic of how a new bin sits on the selected row (top-down + front). */
export function BinCreatePreview({
  rowWidthM,
  rowDepthM,
  rowHeightM,
  binWidthM,
  binDepthM,
  binHeightM,
  occupiedWidthM = 0,
  className,
}: {
  rowWidthM: number
  rowDepthM: number
  rowHeightM: number
  binWidthM: number
  binDepthM: number
  binHeightM: number
  occupiedWidthM?: number
  className?: string
}) {
  const rowW = Math.max(rowWidthM, 0.1)
  const rowD = Math.max(rowDepthM, 0.1)
  const rowH = Math.max(rowHeightM, 0.1)
  const binW = Math.max(binWidthM, 0.05)
  const binD = Math.min(Math.max(binDepthM, 0.05), rowD)
  const binH = Math.min(Math.max(binHeightM, 0.05), rowH)
  const occupied = Math.max(0, Math.min(occupiedWidthM, rowW))
  const free = Math.max(0, rowW - occupied)
  const overflowsW = binW > free + 0.001
  const overflowsD = binDepthM > rowD + 0.001
  const overflowsH = binHeightM > rowH + 0.001
  const overflow = overflowsW || overflowsD || overflowsH

  const binWPct = Math.min(100, (Math.min(binW, free) / rowW) * 100)
  const occPct = Math.min(100, (occupied / rowW) * 100)
  const binDPct = Math.min(100, (binD / rowD) * 100)
  const binHPct = Math.min(100, (binH / rowH) * 100)

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Live bin preview on row
        </p>
        <p
          className={cn(
            'text-[10px] font-medium tabular-nums',
            overflow ? 'text-red-600' : 'text-[#2C5282]',
          )}
        >
          {(binW * 100).toFixed(0)}×{(binD * 100).toFixed(0)}×{(binH * 100).toFixed(0)} cm
          {overflow ? ' · exceeds row' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Top (W × D)</p>
          <div className="flex h-20 w-full items-stretch gap-0.5 rounded-lg border border-dashed border-gray-300 bg-white p-1.5 overflow-hidden">
            {occPct > 0.5 && (
              <div
                className="shrink-0 rounded-sm bg-gray-400/50 border border-gray-500/30"
                style={{ width: `${occPct}%`, height: '100%' }}
                title="Existing bins"
              />
            )}
            <div
              className={cn(
                'rounded-sm border shadow-sm',
                overflow ? 'bg-red-500/70 border-red-600' : 'bg-[#2C5282]/85 border-[#2C5282]',
              )}
              style={{ width: `${Math.max(4, binWPct)}%`, height: `${Math.max(20, binDPct)}%` }}
              title="New bin"
            />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">Front (W × H)</p>
          <div className="flex h-20 w-full items-end gap-0.5 rounded-lg border border-dashed border-gray-300 bg-white p-1.5 overflow-hidden">
            {occPct > 0.5 && (
              <div
                className="shrink-0 rounded-sm bg-gray-400/50 border border-gray-500/30"
                style={{ width: `${occPct}%`, height: '70%' }}
              />
            )}
            <div
              className={cn(
                'rounded-sm border shadow-sm',
                overflow ? 'bg-red-500/70 border-red-600' : 'bg-[#2C5282]/85 border-[#2C5282]',
              )}
              style={{
                width: `${Math.max(4, binWPct)}%`,
                height: `${Math.max(20, binHPct)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 leading-snug">
        Preview updates as you edit dimensions. The same ghost appears on the selected row in 3D.
      </p>
    </div>
  )
}
