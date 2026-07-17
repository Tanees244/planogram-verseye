'use client'

import { useEffect, useState } from 'react'
import type { Rack, Row } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { PosmItemSelect } from '@/components/posm/PosmItemSelect'
import { CreatePosmForm } from '@/components/posm/CreatePosmForm'
import { usePosmItems } from '@/components/posm/usePosmItems'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'
import type { PosmItemListItem } from '@/types/rackBlueprint'
import { resolvePosmImageUrl } from '@/utils/posmImageUrl'

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
  const { items, loading, error, refetch } = usePosmItems(selectedStoreId)

  const rack = findRackForRow(racks, row.id)
  const [posmItemId, setPosmItemId] = useState(row.dividerPosmItemId ?? '')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState<PosmItemListItem[]>([])

  const allItems = [...localItems, ...items.filter((i) => !localItems.some((l) => l.id === i.id))]

  useEffect(() => {
    setPosmItemId(row.dividerPosmItemId ?? '')
  }, [row.id, row.dividerPosmItemId])

  const handleCreated = (item: PosmItemListItem) => {
    setLocalItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)])
    if (!row.dividerPosmItemId) setPosmItemId(item.id)
    void refetch()
  }

  const handleSave = async () => {
    if (!rack) {
      setSaveError('Rack not found for this row')
      return
    }
    if (row.dividerPosmItemId && posmItemId && posmItemId !== row.dividerPosmItemId) {
      setSaveError('Only 1 POSM is allowed per row. Clear the existing POSM first (select None).')
      return
    }
    setBusy(true)
    setSaveError(null)
    try {
      const selected = posmItemId ? allItems.find((p) => p.id === posmItemId) : null
      const res = await assignRow(
        rack.id,
        row.id,
        posmItemId || null,
        selected
          ? {
              id: selected.id,
              name: selected.name,
              posmType: selected.posmType,
              imageUrl: selected.imageUrl,
              imageStorageKey: selected.imageStorageKey,
            }
          : null,
      )
      if (!res.success) setSaveError(res.message ?? 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const assigned = row.dividerPosm
  const previewUrl = resolvePosmImageUrl(
    (allItems.find((p) => p.id === posmItemId) ?? assigned) || {},
  )

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
        Row shelf talker (POSM)
      </p>
      {assigned ? (
        <p className="text-[11px] text-emerald-300/90">
          {assigned.name} · {assigned.posmType}
          {assigned.imageUrl || assigned.imageStorageKey ? ' · has image' : ''}
        </p>
      ) : (
        <p className={cn('text-[11px]', dark ? 'text-gray-500' : 'text-gray-400')}>
          Create or pick a shelf talker with an image. It appears on the front lip of this row in 3D.
        </p>
      )}

      {(error || saveError) && (
        <p className="text-[11px] text-red-400">{saveError || error}</p>
      )}

      <CreatePosmForm storeId={selectedStoreId} dark={dark} onCreated={handleCreated} />

      <PosmItemSelect
        label="Shelf talker POSM"
        value={posmItemId}
        onChange={(id) => {
          setSaveError(null)
          if (row.dividerPosmItemId && id && id !== row.dividerPosmItemId) {
            setSaveError(
              'Only 1 POSM is allowed per row. Clear the existing POSM first (select None).',
            )
          }
          setPosmItemId(id)
        }}
        items={allItems}
        loading={loading}
        dark={dark}
        hint={
          row.dividerPosmItemId
            ? 'To replace POSM, select None, save, then assign a new item.'
            : undefined
        }
      />

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Shelf talker preview"
          className="h-12 w-full object-contain rounded border border-white/10 bg-black/20"
        />
      )}

      <Btn variant="primary" disabled={busy || loading} onClick={handleSave} className="w-full">
        {busy && <Spinner />}
        {busy ? 'Saving…' : 'Save shelf talker'}
      </Btn>
    </div>
  )
}
