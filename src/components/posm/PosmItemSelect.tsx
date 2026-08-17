'use client'

import type { PosmItemListItem } from '@/types/rackBlueprint'
import { cn } from '@/lib/cn'
import { POSM_DRAG_MIME } from '@/components/scene/PosmDropHandler'
import { usePlanogramStore } from '@/store/planogramStore'

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
  const setPosmDragActive = usePlanogramStore((s) => s.setPosmDragActive)

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
            ? 'bg-gray-900 border-white/15 text-white focus:ring-brand/40 [color-scheme:dark]'
            : 'bg-white border-gray-200 text-gray-900 focus:ring-brand/30',
        )}
      >
        <option value="" className={dark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}>
          {loading ? 'Loading…' : 'None'}
        </option>
        {items.map((p) => (
          <option
            key={p.id}
            value={p.id}
            className={dark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}
          >
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
      {/* Draggable chips — drop onto a row/bin in the 3D scene */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {items.slice(0, 12).map((p) => (
            <button
              key={p.id}
              type="button"
              draggable={!disabled}
              onDragStart={(e) => {
                const payload = JSON.stringify({
                  id: p.id,
                  name: p.name,
                  posmType: p.posmType,
                  imageUrl: p.imageUrl ?? null,
                  imageStorageKey: p.imageStorageKey ?? null,
                })
                e.dataTransfer.setData(POSM_DRAG_MIME, payload)
                e.dataTransfer.setData('text/plain', payload)
                e.dataTransfer.effectAllowed = 'copy'
                setPosmDragActive(true)
              }}
              onDragEnd={() => setPosmDragActive(false)}
              onClick={() => onChange(p.id)}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border cursor-grab active:cursor-grabbing',
                value === p.id
                  ? dark
                    ? 'border-brand/50 bg-brand/20 text-brand-100'
                    : 'border-brand/40 bg-brand/10 text-brand'
                  : dark
                    ? 'border-white/10 text-gray-300 hover:bg-white/5'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
              title="Drag onto header, footer, wall, or shelf"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      {hint && (
        <p className={cn('text-[10px]', dark ? 'text-gray-500' : 'text-gray-400')}>{hint}</p>
      )}
    </div>
  )
}
