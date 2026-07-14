'use client'

import type { ReflowException, RackReflowResult } from '@/types/rackReflow'
import { cn } from '@/lib/cn'

function countQtyDirection(preview: RackReflowResult | null) {
  let up = 0
  let down = 0
  let suspicious = 0
  for (const change of preview?.quantityChanges ?? []) {
    const from = Number(change.fromQuantity ?? 0)
    const to = Number(change.toQuantity ?? 0)
    if (to > from) up += 1
    else if (to < from) down += 1
    if (to > 500 || (from > 0 && to / from > 50)) suspicious += 1
  }
  return { up, down, geometry: preview?.geometryChanges?.length ?? 0, suspicious }
}

export function ReflowExceptionTray({
  preview,
  dark = false,
  title = 'Reflow impact',
}: {
  preview: RackReflowResult | null
  dark?: boolean
  title?: string
}) {
  if (!preview) return null

  const exceptions = preview.exceptions ?? []
  const { up, down, geometry, suspicious } = countQtyDirection(preview)

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        dark ? 'border-white/10 bg-white/5 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-900',
      )}
    >
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className={cn('text-xs mt-1', dark ? 'text-gray-400' : 'text-gray-600')}>
          Qty ↑{up} · ↓{down} · geometry {geometry}
          {exceptions.length > 0 ? ` · ${exceptions.length} exception(s)` : ''}
        </p>
        {suspicious > 0 && (
          <p className={cn('text-xs mt-1', dark ? 'text-amber-300' : 'text-amber-700')}>
            Warning: {suspicious} quantity jump(s) look unrealistic (FillToCapacity). Check SKU/bin
            dimensions before applying.
          </p>
        )}
      </div>

      {exceptions.length === 0 ? (
        <p className={cn('text-sm', dark ? 'text-emerald-300' : 'text-emerald-700')}>
          No exceptions — safe to apply.
        </p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {exceptions.map((ex: ReflowException, i) => (
            <li
              key={`${ex.code ?? 'ex'}-${ex.binId ?? ''}-${i}`}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs',
                dark
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                  : 'border-amber-200 bg-amber-50 text-amber-900',
              )}
            >
              <div className="font-semibold font-mono text-[10px] uppercase opacity-80">
                {ex.code ?? 'Exception'}
              </div>
              <div className="mt-0.5">{ex.message}</div>
              {(ex.binId || ex.rowId || ex.skuId || ex.skuName) && (
                <div className={cn('mt-1 opacity-70', dark ? 'text-amber-200' : 'text-amber-800')}>
                  {[ex.skuName, ex.skuId, ex.binId, ex.rowId].filter(Boolean).join(' · ')}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
