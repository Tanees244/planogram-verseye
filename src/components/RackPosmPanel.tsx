'use client'

import { useEffect, useState } from 'react'
import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { PosmItemSelect } from '@/components/posm/PosmItemSelect'
import { usePosmItems } from '@/components/posm/usePosmItems'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'

export function RackPosmPanel({
  rack,
  dark = true,
}: {
  rack: Rack
  dark?: boolean
}) {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const assign = usePlanogramStore((s) => s.assignRackPosmItems)
  const { items, loading, error } = usePosmItems(selectedStoreId)

  const shell = rack.shell
  const [headerId, setHeaderId] = useState(shell?.headerPosmItemId ?? '')
  const [footerId, setFooterId] = useState(shell?.footerPosmItemId ?? '')
  const [leftId, setLeftId] = useState(shell?.leftWallPosmItemId ?? '')
  const [rightId, setRightId] = useState(shell?.rightWallPosmItemId ?? '')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const handleSave = async () => {
    setBusy(true)
    setSaveError(null)
    try {
      const catalog: Record<string, { id: string; name: string; posmType: string }> = {}
      for (const item of items) {
        catalog[item.id] = { id: item.id, name: item.name, posmType: item.posmType }
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
        Rack POSM (shell)
      </p>
      <p className={cn('text-[11px] leading-snug', dark ? 'text-gray-500' : 'text-gray-400')}>
        Assign Company Assets POSM per header, footer, or shell wall. Select the rack (not the row),
        then save — colored plaques appear on those surfaces in 3D. Custom images are defined on the
        POSM asset in Company Assets (not uploaded here).
      </p>

      {(error || saveError) && (
        <p className="text-[11px] text-red-400">{saveError || error}</p>
      )}

      <PosmItemSelect
        label="Header fascia"
        value={headerId}
        onChange={setHeaderId}
        items={items}
        loading={loading}
        disabled={!shell?.header?.enabled}
        dark={dark}
        hint={!shell?.header?.enabled ? 'Enable header in custom rack shell first' : undefined}
      />
      <PosmItemSelect
        label="Footer kick plate"
        value={footerId}
        onChange={setFooterId}
        items={items}
        loading={loading}
        disabled={!shell?.footer?.enabled}
        dark={dark}
        hint={!shell?.footer?.enabled ? 'Enable footer in custom rack shell first' : undefined}
      />
      <PosmItemSelect
        label="Left wall"
        value={leftId}
        onChange={setLeftId}
        items={items}
        loading={loading}
        disabled={walls?.left === false}
        dark={dark}
      />
      <PosmItemSelect
        label="Right wall"
        value={rightId}
        onChange={setRightId}
        items={items}
        loading={loading}
        disabled={walls?.right === false}
        dark={dark}
      />

      <Btn variant="primary" disabled={busy || loading} onClick={handleSave} className="w-full">
        {busy && <Spinner />}
        {busy ? 'Saving…' : 'Save POSM assignments'}
      </Btn>
    </div>
  )
}
