'use client'

import { useMemo, useState } from 'react'
import { FiMove, FiTag } from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import { usePosmItems } from '@/components/posm/usePosmItems'
import { RackPosmPanel } from '@/components/RackPosmPanel'
import { RowDividerPosmPanel } from '@/components/RowDividerPosmPanel'
import { BinItemTagPosmPanel } from '@/components/BinItemTagPosmPanel'
import { CreatePosmForm } from '@/components/posm/CreatePosmForm'
import { POSM_DRAG_MIME } from '@/components/scene/PosmDropHandler'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'
import { resolvePosmImageUrl } from '@/utils/posmImageUrl'

/** Catalog POSM list (drag onto bins/rows) + rack surface assignment when a rack is selected. */
export function PosmPalette({ search = '' }: { search?: string }) {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const selectedType = usePlanogramStore((s) => s.selectedType)
  const racks = usePlanogramStore((s) => s.area.racks)
  const { items, loading, error, refetch } = usePosmItems(selectedStoreId)
  const [showCreate, setShowCreate] = useState(false)

  const rack =
    selectedType === 'rack' && selectedId
      ? racks.find((r) => r.id === selectedId) ?? null
      : null
  const selectedRow =
    selectedType === 'row' && selectedId
      ? (() => {
          for (const r of racks) {
            for (const s of r.sides) {
              const row = s.rows.find((rw) => rw.id === selectedId)
              if (row) return row
            }
          }
          return null
        })()
      : null
  const selectedBin =
    selectedType === 'bin' && selectedId
      ? (() => {
          for (const r of racks) {
            for (const s of r.sides) {
              for (const rw of s.rows) {
                const bin = rw.bins.find((b) => b.id === selectedId)
                if (bin) return bin
              }
            }
          }
          return null
        })()
      : null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.posmType.toLowerCase().includes(q),
    )
  }, [items, search])

  if (!selectedStoreId) {
    return (
      <p className="px-3 py-4 text-[11px] text-gray-400">Select a store to load POSM.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 px-2 py-2">
      {rack && (
        <div className="shrink-0">
          <RackPosmPanel rack={rack} dark />
        </div>
      )}
      {selectedRow && (
        <div className="shrink-0">
          <RowDividerPosmPanel row={selectedRow} dark />
        </div>
      )}
      {selectedBin && (
        <div className="shrink-0">
          <BinItemTagPosmPanel bin={selectedBin} dark />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Catalog · drag onto bin / row
        </p>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="text-[10px] font-semibold text-sky-300 hover:text-white"
        >
          {showCreate ? 'Hide create' : '+ New'}
        </button>
      </div>

      {showCreate && (
        <div className="shrink-0">
          <CreatePosmForm
            storeId={selectedStoreId}
            dark
            onCreated={() => {
              void refetch()
              setShowCreate(false)
            }}
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-gray-400">
          <Spinner className="h-3.5 w-3.5" /> Loading POSM…
        </div>
      )}
      {error && (
        <p className="px-3 text-[11px] text-red-300">{error}</p>
      )}

      <div className="space-y-1.5 pb-2">
        {filtered.map((p) => {
          const thumb = resolvePosmImageUrl({
            imageUrl: p.imageUrl,
            imageStorageKey: p.imageStorageKey,
          })
          return (
            <button
              key={p.id}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  POSM_DRAG_MIME,
                  JSON.stringify({
                    id: p.id,
                    name: p.name,
                    posmType: p.posmType,
                    imageUrl: p.imageUrl ?? null,
                    imageStorageKey: p.imageStorageKey ?? null,
                  }),
                )
                e.dataTransfer.effectAllowed = 'copy'
              }}
              className={cn(
                'w-full flex items-center gap-2.5 p-2 rounded-xl border text-left',
                'bg-white/[0.04] border-white/10 hover:bg-white/10 cursor-grab active:cursor-grabbing',
              )}
              title="Drag onto a bin or row"
            >
              <span className="w-9 h-9 rounded-lg bg-violet-500/20 text-violet-200 flex items-center justify-center shrink-0 overflow-hidden">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FiTag size={14} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{p.posmType}</p>
              </div>
              <FiMove size={12} className="text-gray-500 shrink-0" />
            </button>
          )
        })}
        {!loading && filtered.length === 0 && (
          <p className="px-1 py-3 text-[11px] text-gray-500">No POSM items found.</p>
        )}
      </div>
    </div>
  )
}
