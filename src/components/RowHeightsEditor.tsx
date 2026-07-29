'use client'

import { useEffect, useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import type { Rack, Row } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { cn } from '@/lib/cn'
import { toastApiError } from '@/utils/apiMessages'
import toast from 'react-hot-toast'
import { cmInputFromM, cmToM, mToCm } from '@/utils/lengthUnits'

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
  /** Value in meters (store). */
  value: number
  /** Commit meters back to store. */
  onCommit: (v: number) => void
  dark: boolean
  label: string
  /** Min/max in meters. */
  min?: number
  max?: number
}) {
  const [local, setLocal] = useState(cmInputFromM(value, 1))
  useEffect(() => setLocal(cmInputFromM(value, 1)), [value])

  const commit = () => {
    const cm = parseFloat(local)
    if (!Number.isFinite(cm) || cm < mToCm(min)) {
      setLocal(cmInputFromM(value, 1))
      return
    }
    const m = cmToM(Math.min(cm, mToCm(max)))
    if (Math.abs(m - value) > 0.001) onCommit(m)
  }

  return (
    <input
      type="number"
      step="1"
      min={mToCm(min)}
      max={mToCm(max)}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className={cn(
        'w-[3.75rem] shrink-0 px-1 py-0.5 text-[10px] rounded border focus:outline-none focus:ring-1 text-right',
        dark ? 'bg-white/10 border-white/15 text-white focus:ring-brand' : 'bg-white border-gray-200',
      )}
      aria-label={label}
      title={`${label} (cm)`}
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
            className={cn(
              'flex-1 min-w-0 text-left text-xs truncate transition-colors rounded px-1 -mx-1 py-0.5',
              dark ? 'text-gray-200 hover:text-white hover:bg-white/10' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
            )}
          >
            {label}
          </button>
        ) : (
          <span className="flex-1 min-w-0 text-xs text-gray-300 truncate">{label}</span>
        )
      )}
      <div
        className="flex items-center gap-1.5 shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
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
        <span className={cn('text-[9px]', dark ? 'text-gray-500' : 'text-gray-400')}>cm</span>
      </div>
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
  onAddRow,
}: {
  rack: Rack
  dark?: boolean
  onSelectRow?: (rowId: string) => void
  onAddRow?: () => void
}) {
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const selectedType = usePlanogramStore((s) => s.selectedType)
  const deleteRowFromServer = usePlanogramStore((s) => s.deleteRowFromServer)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const entries = collectRackRows(rack)

  const innerW = rack.customConfig
    ? Math.max(0.1, rack.customConfig.outerWidth - rack.customConfig.wallThickness * 2)
    : rack.width * 0.85

  const shell = dark
    ? 'bg-[#111827] border-slate-600 text-gray-100'
    : 'bg-white border-gray-200 text-gray-800'

  const handleRemove = async (rowId: string, label: string) => {
    if (
      !window.confirm(
        `Delete ${label}? All bins and products on it will be removed.`,
      )
    ) {
      return
    }
    setRemovingId(rowId)
    try {
      const res = await deleteRowFromServer(rowId)
      if (!res.success) toastApiError(res.message)
      else toast.success(res.message ?? 'Row deleted')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className={cn('w-full rounded-xl border p-2.5 space-y-2', shell)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-[10px] font-semibold uppercase tracking-wide', dark ? 'text-gray-400' : 'text-gray-500')}>
            Rows ({entries.length})
          </p>
          {onSelectRow && (
            <p className={cn('text-[10px] mt-1 leading-snug', dark ? 'text-gray-500' : 'text-gray-400')}>
              Click a row below, or Shift+click a bin in 3D. Front shelf lip also selects the row.
            </p>
          )}
        </div>
        {onAddRow && (
          <button
            type="button"
            onClick={onAddRow}
            className={cn(
              'shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors',
              dark
                ? 'bg-brand text-white hover:bg-brand-dark'
                : 'bg-[#2C5282] text-white hover:bg-[#1A365D]',
            )}
          >
            + Add Row
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className={cn('text-[11px] leading-snug', dark ? 'text-gray-500' : 'text-gray-400')}>
          No rows yet. Add rows to create shelves on this rack.
        </p>
      ) : (
        <div className="space-y-1.5">
          {entries.map(({ row, label }) => {
            const isSelected = selectedType === 'row' && selectedId === row.id
            const busy = removingId === row.id
            return (
              <div
                key={row.id}
                className={cn(
                  'rounded-lg border px-2 py-1.5 transition-colors',
                  isSelected
                    ? dark
                      ? 'border-brand/50 bg-brand/15'
                      : 'border-brand/40 bg-brand/5'
                    : dark
                      ? 'border-white/10'
                      : 'border-gray-100',
                  busy && 'opacity-60',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <RowDimensionsField
                      row={row}
                      label={label}
                      dark={dark}
                      maxWidth={innerW}
                      onSelect={onSelectRow ? () => onSelectRow(row.id) : undefined}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || removingId != null}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleRemove(row.id, label)
                    }}
                    title={`Remove ${label}`}
                    className={cn(
                      'shrink-0 p-1 rounded-md transition-colors',
                      dark
                        ? 'text-red-300/80 hover:text-red-200 hover:bg-red-500/20'
                        : 'text-red-500 hover:text-red-600 hover:bg-red-50',
                    )}
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
