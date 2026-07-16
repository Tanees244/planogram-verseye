'use client'

import { cn } from '@/lib/cn'

/** 2D front-of-shelf preview: N facings update live with quantity / dims. */
export function FacingShelfPreview({
  binWidthM,
  binHeightM,
  facingWidthM,
  facingHeightM,
  quantity,
  usedFacings = 0,
  className,
  label = 'Live facing preview',
}: {
  binWidthM: number
  binHeightM: number
  facingWidthM: number
  facingHeightM: number
  quantity: number
  /** Already-occupied facings of the same SKU (shown muted). */
  usedFacings?: number
  className?: string
  label?: string
}) {
  if (!(binWidthM > 0 && binHeightM > 0 && facingWidthM > 0 && facingHeightM > 0)) {
    return null
  }

  const qty = Math.max(0, Math.floor(quantity) || 0)
  const used = Math.max(0, Math.floor(usedFacings) || 0)
  const maxFit = Math.max(1, Math.floor(binWidthM / facingWidthM + 1e-9))
  const overflow = used + qty > maxFit
  const showUsed = Math.min(used, maxFit)
  const showNew = Math.min(qty, Math.max(0, maxFit - showUsed), 48)
  const overflowCount = Math.max(0, used + qty - maxFit)

  const wPct = Math.min(100, (facingWidthM / binWidthM) * 100)
  const hPct = Math.min(100, (facingHeightM / binHeightM) * 100)

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p
          className={cn(
            'text-[10px] font-medium tabular-nums',
            overflow ? 'text-red-600' : 'text-[#2C5282]',
          )}
        >
          {used > 0 ? `${used} + ` : ''}
          {qty} facing{qty === 1 ? '' : 's'}
          {overflow ? ` · +${overflowCount} won’t fit` : ` · max ${maxFit}`}
        </p>
      </div>

      <div className="relative h-24 w-full rounded-lg border border-dashed border-gray-300 bg-white overflow-hidden">
        {/* Shelf cavity */}
        <div className="absolute inset-x-2 bottom-2 top-2 rounded-sm bg-gray-100/80 border border-gray-200" />
        {/* Facings left → right */}
        <div className="absolute inset-x-2 bottom-2 top-2 flex items-end gap-0.5 overflow-hidden">
          {Array.from({ length: showUsed }, (_, i) => (
            <div
              key={`used-${i}`}
              className="shrink-0 rounded-sm bg-gray-400/70 border border-gray-500/40"
              style={{ width: `${wPct}%`, height: `${Math.max(10, hPct)}%` }}
              title="Existing facing"
            />
          ))}
          {Array.from({ length: showNew }, (_, i) => (
            <div
              key={`new-${i}`}
              className={cn(
                'shrink-0 rounded-sm border shadow-sm transition-all duration-150',
                overflow
                  ? 'bg-red-500/80 border-red-600'
                  : 'bg-[#2C5282]/90 border-[#2C5282]',
              )}
              style={{ width: `${wPct}%`, height: `${Math.max(10, hPct)}%` }}
              title={`Facing ${showUsed + i + 1}`}
            />
          ))}
        </div>
      </div>

      <p className="text-[10px] text-gray-500 leading-snug">
        Each block is one facing (
        {(facingWidthM * 100).toFixed(0)}×{(facingHeightM * 100).toFixed(0)} cm) on a{' '}
        {(binWidthM * 100).toFixed(0)} cm shelf. Changes update instantly.
      </p>
    </div>
  )
}
