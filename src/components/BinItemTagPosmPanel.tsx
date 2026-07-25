'use client'

import { useEffect, useState } from 'react'
import type { Bin, Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { PosmItemSelect } from '@/components/posm/PosmItemSelect'
import { CreatePosmForm } from '@/components/posm/CreatePosmForm'
import { usePosmItems } from '@/components/posm/usePosmItems'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'
import type { PosmItemListItem } from '@/types/rackBlueprint'
import { resolvePosmImageUrl } from '@/utils/posmImageUrl'

function findRackForBin(racks: Rack[], binId: string): Rack | null {
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        if (row.bins.some((b) => b.id === binId)) return rack
      }
    }
  }
  return null
}

/** Item-tag / shelf-talker POSM panel for a selected bin. */
export function BinItemTagPosmPanel({
  bin,
  dark = true,
}: {
  bin: Bin
  dark?: boolean
}) {
  const racks = usePlanogramStore((s) => s.area.racks)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const assignBin = usePlanogramStore((s) => s.assignBinItemTagPosm)
  const { items, loading, error, refetch } = usePosmItems(selectedStoreId)

  const rack = findRackForBin(racks, bin.id)
  const [posmItemId, setPosmItemId] = useState(bin.itemTagPosmItemId ?? '')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState<PosmItemListItem[]>([])

  const allItems = [...localItems, ...items.filter((i) => !localItems.some((l) => l.id === i.id))]

  useEffect(() => {
    setPosmItemId(bin.itemTagPosmItemId ?? '')
  }, [bin.id, bin.itemTagPosmItemId])

  const handleCreated = async (item: PosmItemListItem) => {
    setLocalItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)])
    setPosmItemId(item.id)
    void refetch()

    if (!rack || bin.itemTagPosmItemId) return
    setBusy(true)
    setSaveError(null)
    try {
      const res = await assignBin(rack.id, bin.id, item.id, {
        id: item.id,
        name: item.name,
        posmType: item.posmType,
        imageUrl: item.imageUrl,
        imageStorageKey: item.imageStorageKey,
      })
      if (!res.success) {
        setSaveError(res.message ?? 'Created, but failed to assign — click Save item tag')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    if (!rack) {
      setSaveError('Rack not found for this bin')
      return
    }
    if (bin.itemTagPosmItemId && posmItemId && posmItemId !== bin.itemTagPosmItemId) {
      setSaveError('Only 1 POSM is allowed per bin. Clear the existing POSM first (select None).')
      return
    }
    setBusy(true)
    setSaveError(null)
    try {
      const selected = posmItemId ? allItems.find((p) => p.id === posmItemId) : null
      const res = await assignBin(
        rack.id,
        bin.id,
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

  const assigned = bin.itemTagPosm
  const previewUrl = resolvePosmImageUrl(
    (allItems.find((p) => p.id === posmItemId) ?? assigned) || {},
  )

  return (
    <div
      className={cn(
        'w-full rounded-xl border p-2.5 space-y-2',
        dark ? 'bg-[#111827] border-slate-600 text-gray-100' : 'bg-white border-gray-200 text-gray-800',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          dark ? 'text-gray-400' : 'text-gray-500',
        )}
      >
        Bin item tag (POSM)
      </p>
      {assigned ? (
        <p className="text-[11px] text-emerald-300/90">
          {assigned.name} · {assigned.posmType}
          {assigned.imageUrl || assigned.imageStorageKey ? ' · has image' : ''}
        </p>
      ) : (
        <p className={cn('text-[11px]', dark ? 'text-gray-500' : 'text-gray-400')}>
          Create or pick a shelf talker with an image. It appears on the front of this bin in 3D.
        </p>
      )}

      {(error || saveError) && (
        <p className="text-[11px] text-red-400">{saveError || error}</p>
      )}

      <CreatePosmForm storeId={selectedStoreId} dark={dark} onCreated={handleCreated} />

      <PosmItemSelect
        label="Item tag POSM"
        value={posmItemId}
        onChange={(id) => {
          setSaveError(null)
          if (bin.itemTagPosmItemId && id && id !== bin.itemTagPosmItemId) {
            setSaveError(
              'Only 1 POSM is allowed per bin. Clear the existing POSM first (select None).',
            )
          }
          setPosmItemId(id)
        }}
        items={allItems}
        loading={loading}
        dark={dark}
        hint={
          bin.itemTagPosmItemId
            ? 'To replace POSM, select None, save, then assign a new item.'
            : undefined
        }
      />

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Item tag preview"
          className="h-12 w-full object-contain rounded border border-white/10 bg-black/20"
        />
      )}

      <Btn variant="primary" disabled={busy || loading} onClick={handleSave} className="w-full">
        {busy && <Spinner />}
        {busy ? 'Saving…' : 'Save item tag'}
      </Btn>
    </div>
  )
}
