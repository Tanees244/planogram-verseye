'use client'

import { useEffect, useState } from 'react'
import type { Rack, Row } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { cn } from '@/lib/cn'

export type RowEntry = { row: Row; label: string }

export function collectRackRows(rack: Rack): RowEntry[] {
  const entries: RowEntry[] = []
  rack.sides.forEach((side) => {
    side.rows.forEach((row, idx) => {
      const prefix = rack.sides.length > 1 ? `Side ${side.sideCode} · ` : ''
      entries.push({ row, label: `${prefix}Row ${idx + 1}` })
    })
  })
  return entries
}

function DimInput({
  value,
  onCommit,
  dark,
  label,
  min = 0.1,
  max = 10,
}: {
  value: number
  onCommit: (v: number) => void
  dark: boolean
  label: string
  min?: number
  max?: number
}) {
  const [local, setLocal] = useState(String(value))
  useEffect(() => setLocal(String(value)), [value])

  const commit = () => {
    const n = parseFloat(local)
    if (!Number.isFinite(n) || n < min) {
      setLocal(String(value))
      return
    }
    if (Math.abs(n - value) > 0.001) onCommit(n)
  }

  return (
    <input
      type="number"
      step="0.05"
      min={min}
      max={max}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className={cn(
        'w-[3.75rem] shrink-0 px-1 py-0.5 text-[10px] rounded border focus:outline-none focus:ring-1 text-right',
        dark ? 'bg-white/10 border-white/15 text-white focus:ring-brand' : 'bg-white border-gray-200',
      )}
      aria-label={label}
    />
  )
}

export function RowDimensionsField({
  row,
  label,
  dark = true,
  showLabel = true,
  onSelect,
  maxWidth,
}: {
  row: Row
  label?: string
  dark?: boolean
  showLabel?: boolean
  onSelect?: () => void
  maxWidth?: number
}) {
  const updateRowDimensions = usePlanogramStore((s) => s.updateRowDimensions)
  const [saving, setSaving] = useState(false)

  const save = async (dims: { height?: number; width?: number }) => {
    setSaving(true)
    try {
      await updateRowDimensions(row.id, dims)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('flex items-center gap-1.5 min-w-0', saving && 'opacity-60')}>
      {showLabel && label && (
        onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className="flex-1 min-w-0 text-left text-xs text-gray-300 truncate hover:text-white transition-colors"
          >
            {label}
          </button>
        ) : (
          <span className="flex-1 min-w-0 text-xs text-gray-300 truncate">{label}</span>
        )
      )}
      <DimInput
        value={row.width ?? maxWidth ?? 1}
        dark={dark}
        label={`${label} width`}
        max={maxWidth ?? 10}
        onCommit={(width) => void save({ width })}
      />
      <span className={cn('text-[9px]', dark ? 'text-gray-500' : 'text-gray-400')}>W</span>
      <DimInput
        value={row.height}
        dark={dark}
        label={`${label} height`}
        onCommit={(height) => void save({ height })}
      />
      <span className={cn('text-[9px]', dark ? 'text-gray-500' : 'text-gray-400')}>H</span>
    </div>
  )
}

/** @deprecated use RowDimensionsField */
export function RowHeightField({
  row,
  label,
  dark = true,
  showLabel = true,
  onSelect,
}: {
  row: Row
  label?: string
  dark?: boolean
  showLabel?: boolean
  onSelect?: () => void
}) {
  return (
    <RowDimensionsField
      row={row}
      label={label}
      dark={dark}
      showLabel={showLabel}
      onSelect={onSelect}
    />
  )
}

export function RackRowHeightsPanel({
  rack,
  dark = true,
  onSelectRow,
}: {
  rack: Rack
  dark?: boolean
  onSelectRow?: (rowId: string) => void
}) {
  const entries = collectRackRows(rack)
  if (entries.length === 0) return null

  const innerW = rack.customConfig
    ? Math.max(0.1, rack.customConfig.outerWidth - rack.customConfig.wallThickness * 2)
    : rack.width * 0.85

  const shell = dark
    ? 'bg-black/70 border-white/10 text-gray-100'
    : 'bg-white border-gray-200 text-gray-800'

  return (
    <div className={cn('w-full rounded-xl border p-2.5 space-y-2', shell)}>
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', dark ? 'text-gray-400' : 'text-gray-500')}>
        Rows ({entries.length}) — width × height
      </p>
      <div className="space-y-1.5">
        {entries.map(({ row, label }) => (
          <RowDimensionsField
            key={row.id}
            row={row}
            label={label}
            dark={dark}
            maxWidth={innerW}
            onSelect={onSelectRow ? () => onSelectRow(row.id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
