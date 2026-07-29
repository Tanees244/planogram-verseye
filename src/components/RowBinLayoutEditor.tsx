'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { cn } from '@/lib/cn'

export type DraftBinLayout = {
  id: string
  name: string
  /** Width in meters */
  widthM: number
  depthM: number
  heightM: number
}

type ExistingBin = {
  id: string
  name?: string
  widthM: number
  heightM?: number
}

type Props = {
  rowWidthM: number
  rowHeightM: number
  rowDepthM: number
  existingBins?: ExistingBin[]
  drafts: DraftBinLayout[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (next: DraftBinLayout[]) => void
  className?: string
}

const PX_PER_M_MIN = 80

function uid() {
  return `draft-${Math.random().toString(36).slice(2, 9)}`
}

/** Interactive 2D row strip: drag draft bins, resize W/H, add/remove before save. */
export function RowBinLayoutEditor({
  rowWidthM,
  rowHeightM,
  rowDepthM,
  existingBins = [],
  drafts,
  selectedId,
  onSelect,
  onChange,
  className,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackW, setTrackW] = useState(480)
  const dragRef = useRef<{
    kind: 'move' | 'resizeW' | 'resizeH'
    id: string
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    order: string[]
  } | null>(null)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth || 480))
    ro.observe(el)
    setTrackW(el.clientWidth || 480)
    return () => ro.disconnect()
  }, [])

  const occupiedM = existingBins.reduce((s, b) => s + Math.max(0, b.widthM), 0)
  const freeM = Math.max(0, rowWidthM - occupiedM)
  const draftUsed = drafts.reduce((s, b) => s + Math.max(0, b.widthM), 0)
  const remainingM = Math.max(0, freeM - draftUsed)
  const pxPerM = Math.max(PX_PER_M_MIN, trackW / Math.max(rowWidthM, 0.2))

  const heightScale = Math.max(56, Math.min(140, rowHeightM * 220))

  const addDraft = () => {
    const w = Math.min(
      Math.max(0.15, remainingM > 0.05 ? Math.min(remainingM, freeM * 0.25 || 0.35) : 0.2),
      Math.max(0.1, remainingM || freeM),
    )
    if (!(w > 0.05) || remainingM < 0.08) return
    const next: DraftBinLayout = {
      id: uid(),
      name: `Bin ${existingBins.length + drafts.length + 1}`,
      widthM: Math.round(w * 1000) / 1000,
      depthM: Math.round(Math.min(rowDepthM, Math.max(0.15, rowDepthM)) * 1000) / 1000,
      heightM: Math.round(Math.min(rowHeightM * 0.9, Math.max(0.15, rowHeightM - 0.05)) * 1000) / 1000,
    }
    onChange([...drafts, next])
    onSelect(next.id)
  }

  const removeDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id)
    onChange(next)
    if (selectedId === id) onSelect(next[0]?.id ?? null)
  }

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const dW = dx / pxPerM
      const dH = -dy / (heightScale / Math.max(rowHeightM, 0.1))

      if (drag.kind === 'resizeW') {
        onChange(
          drafts.map((d) => {
            if (d.id !== drag.id) return d
            const others = drafts
              .filter((x) => x.id !== d.id)
              .reduce((s, x) => s + x.widthM, 0)
            const maxW = Math.max(0.1, freeM - others - 0.001)
            const nextW = Math.min(maxW, Math.max(0.08, drag.startWidth + dW))
            return { ...d, widthM: Math.round(nextW * 1000) / 1000 }
          }),
        )
        return
      }

      if (drag.kind === 'resizeH') {
        onChange(
          drafts.map((d) => {
            if (d.id !== drag.id) return d
            const nextH = Math.min(
              rowHeightM - 0.01,
              Math.max(0.08, drag.startHeight + dH),
            )
            return { ...d, heightM: Math.round(nextH * 1000) / 1000 }
          }),
        )
        return
      }

      // Reorder by pointer x over draft slots
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const xInRow = (e.clientX - rect.left) / pxPerM - occupiedM
      let acc = 0
      let insertAt = drafts.length - 1
      for (let i = 0; i < drafts.length; i++) {
        const mid = acc + drafts[i].widthM / 2
        if (xInRow < mid) {
          insertAt = i
          break
        }
        acc += drafts[i].widthM
        insertAt = i
      }
      const from = drafts.findIndex((d) => d.id === drag.id)
      if (from < 0 || from === insertAt) return
      const ordered = [...drafts]
      const [item] = ordered.splice(from, 1)
      ordered.splice(insertAt, 0, item)
      onChange(ordered)
    },
    [drafts, freeM, heightScale, occupiedM, onChange, pxPerM, rowHeightM],
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [endDrag, onPointerMove])

  const startDrag = (
    kind: 'move' | 'resizeW' | 'resizeH',
    id: string,
    e: React.PointerEvent,
    startWidth: number,
    startHeight: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(id)
    dragRef.current = {
      kind,
      id,
      startX: e.clientX,
      startY: e.clientY,
      startWidth,
      startHeight,
      order: drafts.map((d) => d.id),
    }
  }

  const overflow = draftUsed > freeM + 0.002

  const legend = useMemo(
    () =>
      `${Math.round(occupiedM * 100)} cm used · ${Math.round(remainingM * 100)} cm free · ${drafts.length} new`,
    [drafts.length, occupiedM, remainingM],
  )

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 space-y-2', className)}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Row layout editor
          </p>
          <p className="text-[10px] text-gray-500 tabular-nums">{legend}</p>
        </div>
        <button
          type="button"
          onClick={addDraft}
          disabled={remainingM < 0.08}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold',
            remainingM < 0.08
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-brand text-white hover:bg-brand-dark',
          )}
        >
          <FiPlus size={12} /> Add box
        </button>
      </div>

      {/* Front elevation: height resize */}
      <div
        className="relative w-full rounded-lg border border-dashed border-gray-300 bg-white overflow-hidden"
        style={{ height: heightScale + 28 }}
      >
        <div className="absolute left-2 top-1 text-[9px] text-gray-400 font-medium">
          Front · drag top edge to change height
        </div>
        <div
          ref={trackRef}
          className="absolute left-2 right-2 bottom-2 flex items-end overflow-hidden rounded-md bg-slate-100/80"
          style={{ height: heightScale }}
          onClick={() => onSelect(null)}
        >
          {existingBins.map((b) => (
            <div
              key={b.id}
              title={b.name || 'Existing'}
              className="shrink-0 border border-slate-400/60 bg-slate-400/50 text-[9px] text-slate-700 font-semibold flex items-end justify-center pb-1 select-none"
              style={{
                width: Math.max(4, b.widthM * pxPerM),
                height: `${Math.max(18, ((b.heightM ?? rowHeightM * 0.85) / rowHeightM) * 100)}%`,
              }}
            >
              <span className="truncate px-0.5 opacity-80">{b.name || 'Ex'}</span>
            </div>
          ))}

          {drafts.map((d) => {
            const selected = selectedId === d.id
            const hPct = Math.max(12, Math.min(100, (d.heightM / rowHeightM) * 100))
            return (
              <div
                key={d.id}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(d.id)
                }}
                onPointerDown={(e) => startDrag('move', d.id, e, d.widthM, d.heightM)}
                className={cn(
                  'relative shrink-0 border-2 flex flex-col items-center justify-end pb-1 cursor-grab active:cursor-grabbing select-none',
                  selected
                    ? 'border-brand bg-brand/80 text-white z-10'
                    : 'border-brand/50 bg-brand/55 text-white/95',
                  overflow && 'ring-2 ring-red-400',
                )}
                style={{
                  width: Math.max(8, d.widthM * pxPerM),
                  height: `${hPct}%`,
                }}
              >
                <span className="text-[9px] font-bold truncate px-0.5 w-full text-center">
                  {d.name}
                </span>
                <span className="text-[8px] opacity-90 tabular-nums">
                  {Math.round(d.widthM * 100)}×{Math.round(d.heightM * 100)}
                </span>

                {/* Height handle (top) */}
                <div
                  className="absolute left-1 right-1 top-0 h-2 cursor-ns-resize bg-white/30 hover:bg-white/55 rounded-b"
                  onPointerDown={(e) => startDrag('resizeH', d.id, e, d.widthM, d.heightM)}
                  title="Resize height"
                />
                {/* Width handle (right) */}
                <div
                  className="absolute top-2 bottom-2 right-0 w-2 cursor-ew-resize bg-white/30 hover:bg-white/55 rounded-l"
                  onPointerDown={(e) => startDrag('resizeW', d.id, e, d.widthM, d.heightM)}
                  title="Resize width"
                />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeDraft(d.id)
                  }}
                  title="Remove"
                >
                  <FiTrash2 size={10} />
                </button>
              </div>
            )
          })}

          {remainingM > 0.05 && (
            <div
              className="shrink-0 h-full border border-dashed border-sky-300/70 bg-sky-50/40"
              style={{ width: Math.max(2, remainingM * pxPerM) }}
              title="Free space"
            />
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-500 leading-snug">
        Gray = existing bins (locked). Blue = new bins — drag to reorder, edges to resize W/H, then
        Save to create them on this row. Depth defaults to row max ({Math.round(rowDepthM * 100)} cm).
      </p>
      {overflow && (
        <p className="text-[10px] font-medium text-red-600">
          Draft bins exceed free row width — shrink or remove a box.
        </p>
      )}
    </div>
  )
}

export function createInitialDraft(
  freeM: number,
  rowDepthM: number,
  rowHeightM: number,
  index = 1,
): DraftBinLayout {
  const w = Math.min(Math.max(0.2, freeM * 0.35 || 0.35), Math.max(0.15, freeM))
  return {
    id: uid(),
    name: `Bin ${index}`,
    widthM: Math.round(w * 1000) / 1000,
    depthM: Math.round(Math.max(0.15, rowDepthM) * 1000) / 1000,
    heightM: Math.round(
      Math.min(rowHeightM * 0.9, Math.max(0.15, rowHeightM - 0.05)) * 1000,
    ) / 1000,
  }
}
