'use client'

import { useEffect, useState } from 'react'
import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { PosmItemSelect } from '@/components/posm/PosmItemSelect'
import { CreatePosmForm } from '@/components/posm/CreatePosmForm'
import { usePosmItems } from '@/components/posm/usePosmItems'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'
import type { PosmItemListItem } from '@/types/rackBlueprint'
import { resolvePosmImageUrl } from '@/utils/posmImageUrl'

export function RackPosmPanel({
  rack,
  dark = true,
}: {
  rack: Rack
  dark?: boolean
}) {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const assign = usePlanogramStore((s) => s.assignRackPosmItems)
  const { items, loading, error, refetch } = usePosmItems(selectedStoreId)

  const shell = rack.shell
  const [headerId, setHeaderId] = useState(shell?.headerPosmItemId ?? '')
  const [footerId, setFooterId] = useState(shell?.footerPosmItemId ?? '')
  const [leftId, setLeftId] = useState(shell?.leftWallPosmItemId ?? '')
  const [rightId, setRightId] = useState(shell?.rightWallPosmItemId ?? '')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState<PosmItemListItem[]>([])

  const allItems = [...localItems, ...items.filter((i) => !localItems.some((l) => l.id === i.id))]

  useEffect(() => {
    setHeaderId(shell?.headerPosmItemId ?? '')
    setFooterId(shell?.footerPosmItemId ?? '')
    setLeftId(shell?.leftWallPosmItemId ?? '')
    setRightId(shell?.rightWallPosmItemId ?? '')
  }, [
    rack.id,
    shell?.headerPosmItemId,
    shell?.footerPosmItemId,
    shell?.leftWallPosmItemId,
    shell?.rightWallPosmItemId,
  ])

  const handleCreated = (item: PosmItemListItem) => {
    setLocalItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)])
    // Auto-select onto header so attach is one click away
    if (!headerId) setHeaderId(item.id)
    void refetch()
  }

  const handleSave = async () => {
    setBusy(true)
    setSaveError(null)
    try {
      const catalog: Record<
        string,
        { id: string; name: string; posmType: string; imageUrl?: string | null; imageStorageKey?: string | null }
      > = {}
      for (const item of allItems) {
        catalog[item.id] = {
          id: item.id,
          name: item.name,
          posmType: item.posmType,
          imageUrl: item.imageUrl,
          imageStorageKey: item.imageStorageKey,
        }
      }
      const res = await assign(
        rack.id,
        {
          headerPosmItemId: headerId || null,
          footerPosmItemId: footerId || null,
          leftWallPosmItemId: leftId || null,
          rightWallPosmItemId: rightId || null,
        },
        catalog,
      )
      if (!res.success) setSaveError(res.message ?? 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const walls = shell?.walls
  const isCustom = rack.fixtureType === 'CUSTOM'
  const headerEnabled = Boolean(shell?.header?.enabled) || !isCustom
  const footerEnabled = Boolean(shell?.footer?.enabled) || !isCustom
  const leftEnabled = walls?.left !== false
  const rightEnabled = walls?.right !== false
  const previewFor = (id: string) => {
    const item = allItems.find((p) => p.id === id)
    if (!item) return null
    return resolvePosmImageUrl(item)
  }

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
        Rack POSM — header / footer / walls
      </p>
      <p className={cn('text-[11px] leading-snug', dark ? 'text-gray-500' : 'text-gray-400')}>
        Create a POSM with an image below, then assign it to a surface and save.
      </p>

      {(error || saveError) && (
        <p className="text-[11px] text-red-400">{saveError || error}</p>
      )}

      <CreatePosmForm storeId={selectedStoreId} dark={dark} onCreated={handleCreated} />

      <PosmItemSelect
        label="Header fascia"
        value={headerId}
        onChange={setHeaderId}
        items={allItems}
        loading={loading}
        disabled={!headerEnabled}
        dark={dark}
        hint={!headerEnabled ? 'Enable header in custom rack shell first' : undefined}
      />
      {previewFor(headerId) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewFor(headerId)!}
          alt="Header POSM"
          className="h-10 w-full object-contain rounded border border-white/10 bg-black/20"
        />
      )}
      <PosmItemSelect
        label="Footer kick plate"
        value={footerId}
        onChange={setFooterId}
        items={allItems}
        loading={loading}
        disabled={!footerEnabled}
        dark={dark}
        hint={!footerEnabled ? 'Enable footer in custom rack shell first' : undefined}
      />
      {previewFor(footerId) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewFor(footerId)!}
          alt="Footer POSM"
          className="h-10 w-full object-contain rounded border border-white/10 bg-black/20"
        />
      )}
      <PosmItemSelect
        label="Left wall"
        value={leftId}
        onChange={setLeftId}
        items={allItems}
        loading={loading}
        disabled={!leftEnabled}
        dark={dark}
      />
      {previewFor(leftId) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewFor(leftId)!}
          alt="Left wall POSM"
          className="h-10 w-full object-contain rounded border border-white/10 bg-black/20"
        />
      )}
      <PosmItemSelect
        label="Right wall"
        value={rightId}
        onChange={setRightId}
        items={allItems}
        loading={loading}
        disabled={!rightEnabled}
        dark={dark}
      />
      {previewFor(rightId) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewFor(rightId)!}
          alt="Right wall POSM"
          className="h-10 w-full object-contain rounded border border-white/10 bg-black/20"
        />
      )}

      <Btn variant="primary" disabled={busy || loading} onClick={handleSave} className="w-full">
        {busy && <Spinner />}
        {busy ? 'Saving…' : 'Save POSM assignments'}
      </Btn>
    </div>
  )
}
