'use client'

import { useEffect, useState } from 'react'
import type { Rack, Row } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { PosmItemSelect } from '@/components/posm/PosmItemSelect'
import { usePosmItems } from '@/components/posm/usePosmItems'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'

function findRackForRow(racks: Rack[], rowId: string): Rack | null {
  for (const rack of racks) {
    for (const side of rack.sides) {
      if (side.rows.some((r) => r.id === rowId)) return rack
    }
  }
  return null
}

export function RowDividerPosmPanel({
  row,
  dark = true,
}: {
  row: Row
  dark?: boolean
}) {
  const racks = usePlanogramStore((s) => s.area.racks)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const assignRow = usePlanogramStore((s) => s.assignRowDividerPosm)
  const { items, loading, error } = usePosmItems(selectedStoreId)

  const rack = findRackForRow(racks, row.id)
  const [posmItemId, setPosmItemId] = useState(row.dividerPosmItemId ?? '')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setPosmItemId(row.dividerPosmItemId ?? '')
  }, [row.id, row.dividerPosmItemId])

  const handleSave = async () => {
    if (!rack) {
      setSaveError('Rack not found for this row')
      return
    }
    setBusy(true)
    setSaveError(null)
    try {
      const selected = posmItemId ? items.find((p) => p.id === posmItemId) : null
      const res = await assignRow(
        rack.id,
        row.id,
        posmItemId || null,
        selected
          ? { id: selected.id, name: selected.name, posmType: selected.posmType }
          : null,
      )
      if (!res.success) setSaveError(res.message ?? 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const assigned = row.dividerPosm

  return (
    <div
      className={cn(
        'w-full rounded-xl border p-2.5 space-y-2',
        dark ? 'bg-black/70 border-white/10 text-gray-100' : 'bg-white border-gray-200 text-gray-800',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          dark ? 'text-gray-400' : 'text-gray-500',
        )}
      >
        Row divider POSM
      </p>
      {assigned ? (
        <p className="text-[11px] text-emerald-300/90">
          {assigned.name} · {assigned.posmType}
        </p>
      ) : (
        <p className={cn('text-[11px]', dark ? 'text-gray-500' : 'text-gray-400')}>
          Assign a POSM item on the shelf lip / divider. After save, a green tag appears on the
          front lip in 3D (click it to re-select the row).
        </p>
      )}

      {(error || saveError) && (
        <p className="text-[11px] text-red-400">{saveError || error}</p>
      )}

      <PosmItemSelect
        label="Divider POSM"
        value={posmItemId}
        onChange={setPosmItemId}
        items={items}
        loading={loading}
        dark={dark}
      />

      <Btn variant="primary" disabled={busy || loading} onClick={handleSave} className="w-full">
        {busy && <Spinner />}
        {busy ? 'Saving…' : 'Save divider POSM'}
      </Btn>
    </div>
  )
}

