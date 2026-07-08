'use client'

import { useState } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import type { Row } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { Btn, FormField, Input } from '@/components/ui/form'
import { cn } from '@/lib/cn'
import { Spinner } from '@/components/Spinner'

export function ShelfTalkerPanel({
  row,
  dark = true,
}: {
  row: Row
  dark?: boolean
}) {
  const addTalker = usePlanogramStore((s) => s.addShelfTalkerToServer)
  const deleteTalker = usePlanogramStore((s) => s.deleteShelfTalkerFromServer)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: '',
    length: '0.20',
    innerDepth: '0.05',
    outerHeight: '0.08',
    slotPosition: '1',
    placementZone: 'inner',
  })

  const talkers = row.talkers ?? []

  const handleAdd = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await addTalker(row.id, {
        label: form.label.trim() || null,
        length: parseFloat(form.length) || 0.2,
        innerDepth: parseFloat(form.innerDepth) || 0.05,
        outerHeight: parseFloat(form.outerHeight) || 0.08,
        slotPosition: Math.max(1, parseInt(form.slotPosition, 10) || 1),
        placementZone: form.placementZone || 'inner',
      })
      if (!res.success) {
        setError(res.message ?? 'Failed to add shelf talker')
        return
      }
      setOpen(false)
      setForm({
        label: '',
        length: '0.20',
        innerDepth: '0.05',
        outerHeight: '0.08',
        slotPosition: String((talkers.length || 0) + 2),
        placementZone: 'inner',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'w-full rounded-xl border p-2.5 space-y-2',
        dark ? 'bg-black/70 border-white/10 text-gray-100' : 'bg-white border-gray-200 text-gray-800',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wide',
            dark ? 'text-gray-400' : 'text-gray-500',
          )}
        >
          Shelf talkers ({talkers.length})
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors',
            dark
              ? 'border-white/15 text-brand-light hover:bg-white/10'
              : 'border-gray-200 text-brand hover:bg-brand/5',
          )}
        >
          <span className="inline-flex items-center gap-1">
            <FiPlus size={12} /> Add
          </span>
        </button>
      </div>

      {talkers.length === 0 ? (
        <p className={cn('text-[11px]', dark ? 'text-gray-500' : 'text-gray-400')}>
          No shelf talkers on this row.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {talkers.map((t) => (
            <li
              key={t.id}
              className={cn(
                'flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-[11px]',
                dark ? 'bg-white/5' : 'bg-gray-50',
              )}
            >
              <span className="truncate">
                {t.label || `Slot ${t.slotPosition}`} · {t.length.toFixed(2)}m · {t.placementZone}
              </span>
              <button
                type="button"
                className="text-red-400 hover:text-red-300 shrink-0"
                onClick={async () => {
                  setBusy(true)
                  const res = await deleteTalker(t.id, row.id)
                  if (!res.success) setError(res.message ?? 'Delete failed')
                  setBusy(false)
                }}
              >
                <FiTrash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="space-y-2 pt-1 border-t border-white/10">
          <FormField label="Label">
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Promo label"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Length (m)">
              <Input
                type="number"
                step="0.01"
                min={0.01}
                value={form.length}
                onChange={(e) => setForm({ ...form, length: e.target.value })}
              />
            </FormField>
            <FormField label="Inner depth (m)">
              <Input
                type="number"
                step="0.01"
                min={0.01}
                value={form.innerDepth}
                onChange={(e) => setForm({ ...form, innerDepth: e.target.value })}
              />
            </FormField>
            <FormField label="Outer height (m)">
              <Input
                type="number"
                step="0.01"
                min={0.01}
                value={form.outerHeight}
                onChange={(e) => setForm({ ...form, outerHeight: e.target.value })}
              />
            </FormField>
            <FormField label="Slot">
              <Input
                type="number"
                min={1}
                value={form.slotPosition}
                onChange={(e) => setForm({ ...form, slotPosition: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Zone">
            <select
              value={form.placementZone}
              onChange={(e) => setForm({ ...form, placementZone: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="inner">inner</option>
              <option value="outer">outer</option>
              <option value="header">header</option>
              <option value="footer">footer</option>
            </select>
          </FormField>
          <Btn variant="primary" disabled={busy} onClick={handleAdd} className="w-full">
            {busy && <Spinner />}
            {busy ? 'Saving…' : 'Create talker'}
          </Btn>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}
    </div>
  )
}
