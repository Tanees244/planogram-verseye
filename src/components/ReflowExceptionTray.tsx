'use client'

import type { ReflowException, RackReflowPreview } from '@/types/rackReflow'
import { cn } from '@/lib/cn'

export function ReflowExceptionTray({
  preview,
  dark = true,
  className,
}: {
  preview: RackReflowPreview | null
  dark?: boolean
  className?: string
}) {
  if (!preview) return null

  const { quantityChanges, geometryChanges, exceptions } = preview
  const hasQty = quantityChanges.length > 0
  const hasGeom = geometryChanges.length > 0
  const hasExc = exceptions.length > 0

  if (!hasQty && !hasGeom && !hasExc) {
    return (
      <p className={cn('text-[11px]', dark ? 'text-emerald-300/90' : 'text-emerald-700', className)}>
        No quantity or geometry changes — rack fits as-is.
      </p>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {hasExc && (
        <div
          className={cn(
            'rounded-lg border p-2.5 space-y-1.5',
            dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200',
          )}
        >
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide',
              dark ? 'text-amber-200' : 'text-amber-800',
            )}
          >
            Exceptions ({exceptions.length}) — SKUs stay attached
          </p>
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {exceptions.map((ex: ReflowException, i) => (
              <li
                key={`${ex.code ?? 'ex'}-${i}`}
                className={cn('text-[11px] leading-snug', dark ? 'text-amber-100' : 'text-amber-900')}
              >
                {ex.code ? (
                  <span className="font-mono text-[10px] opacity-80">{ex.code}: </span>
                ) : null}
                {ex.message}
                {ex.skuName ? ` (${ex.skuName})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasQty && (
        <div className={cn('rounded-lg border p-2.5', dark ? 'border-white/10' : 'border-gray-200')}>
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide mb-1.5',
              dark ? 'text-gray-400' : 'text-gray-500',
            )}
          >
            Quantity changes ({quantityChanges.length})
          </p>
          <ul className="space-y-1 max-h-28 overflow-y-auto">
            {quantityChanges.map((q) => (
              <li key={`${q.binId}-${q.skuId}`} className={cn('text-[11px]', dark ? 'text-gray-300' : 'text-gray-700')}>
                <span className="font-medium">{q.skuName ?? q.skuId.slice(0, 8)}</span>
                {' · '}
                {q.fromQuantity} → {q.toQuantity} facings
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasGeom && (
        <div className={cn('rounded-lg border p-2.5', dark ? 'border-white/10' : 'border-gray-200')}>
          <p
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wide mb-1.5',
              dark ? 'text-gray-400' : 'text-gray-500',
            )}
          >
            Geometry changes ({geometryChanges.length})
          </p>
          <ul className="space-y-0.5 max-h-24 overflow-y-auto font-mono text-[10px]">
            {geometryChanges.slice(0, 12).map((g, i) => (
              <li key={`${g.entityId}-${g.field}-${i}`} className={dark ? 'text-gray-400' : 'text-gray-600'}>
                {g.field}: {g.from?.toFixed?.(3) ?? g.from} → {g.to?.toFixed?.(3) ?? g.to}
              </li>
            ))}
            {geometryChanges.length > 12 && (
              <li className={dark ? 'text-gray-500' : 'text-gray-400'}>
                …and {geometryChanges.length - 12} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
