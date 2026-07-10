'use client'

import type { PosmItemListItem } from '@/types/rackBlueprint'
import { cn } from '@/lib/cn'

export function PosmItemSelect({
  label,
  value,
  onChange,
  items,
  loading,
  disabled,
  dark = true,
  hint,
}: {
  label: string
  value: string
  onChange: (posmItemId: string) => void
  items: PosmItemListItem[]
  loading?: boolean
  disabled?: boolean
  dark?: boolean
  hint?: string
}) {
  const selected = items.find((p) => p.id === value)

  return (
    <div className="space-y-1">
      <label
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          dark ? 'text-gray-400' : 'text-gray-500',
        )}
      >
        {label}
      </label>
      <select
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-lg border px-2.5 py-2 text-xs focus:outline-none focus:ring-2',
          dark
            ? 'bg-white/5 border-white/15 text-white focus:ring-brand/40'
            : 'bg-white border-gray-200 text-gray-900 focus:ring-brand/30',
        )}
      >
        <option value="">{loading ? 'Loading…' : 'None'}</option>
        {items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.posmType})
          </option>
        ))}
      </select>
      {selected && (
        <p className={cn('text-[10px]', dark ? 'text-gray-500' : 'text-gray-400')}>
          {selected.posmType}
          {selected.assignedStoresLabel ? ` · ${selected.assignedStoresLabel}` : ''}
        </p>
      )}
      {hint && (
        <p className={cn('text-[10px]', dark ? 'text-gray-500' : 'text-gray-400')}>{hint}</p>
      )}
    </div>
  )
}
