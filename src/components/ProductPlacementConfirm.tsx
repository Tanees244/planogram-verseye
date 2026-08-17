'use client'

import { useMemo } from 'react'
import { FiCheck, FiMinus, FiPlus, FiX } from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  findRowPlacementContext,
  maxDepthRows,
  maxFrontFacings,
  maxStackLayers,
  quantityFromPack,
  remainingRowFillPlan,
} from '@/utils/productRowPlacement'
import { resolveIsStackable } from '@/utils/stackableSku'
import { cn } from '@/lib/cn'
import { PANEL_SHELL } from '@/lib/uiShell'
import toast from 'react-hot-toast'

/** Confirm front × depth × stack before auto-creating a bin and attaching. */
export function ProductPlacementConfirm({ className }: { className?: string }) {
  const draft = usePlanogramStore((s) => s.productPlacementDraft)
  const pending = usePlanogramStore((s) => s.pendingProductParams)
  const racks = usePlanogramStore((s) => s.area.racks)
  const isAttaching = usePlanogramStore((s) => s.isAttachingProduct)
  const updateQty = usePlanogramStore((s) => s.updateProductPlacementQty)
  const confirm = usePlanogramStore((s) => s.confirmProductPlacementOnRow)
  const cancel = usePlanogramStore((s) => s.cancelProductPlacement)

  const shelfHint = useMemo(() => {
    if (!draft || !pending) return null
    const ctx = findRowPlacementContext(racks, draft.rowId)
    if (!ctx) return null
    const stackable = resolveIsStackable(pending.id, { isStackable: pending.isStackable })
    return {
      remainingCm: Math.round(ctx.remainingWidth * 100),
      depthCm: Math.round(ctx.availableDepth * 100),
      heightCm: Math.round(ctx.rowHeight * 100),
      maxFacings: Math.max(1, maxFrontFacings(ctx.remainingWidth, pending.width)),
      maxDepth: Math.max(1, maxDepthRows(ctx.availableDepth, pending.depth)),
      maxStack: Math.max(1, maxStackLayers(ctx.rowHeight, pending.height, stackable)),
    }
  }, [draft, pending, racks])

  const fillRemaining = draft?.fillRemaining === true
  const fillPlan = useMemo(() => {
    if (!draft || !pending) return null
    const ctx = findRowPlacementContext(racks, draft.rowId)
    if (!ctx) return null
    return remainingRowFillPlan(
      pending,
      { facings: draft.facings, depth: draft.depth, stack: draft.stack },
      ctx.remainingWidth,
      ctx.availableDepth,
      ctx.rowHeight,
      draft.fillRemaining === true,
    )
  }, [draft, pending, racks])

  if (!draft || !pending || !shelfHint) return null

  const stackable = resolveIsStackable(pending.id, { isStackable: pending.isStackable })
  const qty = quantityFromPack(draft.facings, draft.depth, stackable ? draft.stack : 1)

  const onConfirm = async () => {
    const res = await confirm()
    if (res.success) toast.success(res.message ?? 'Product placed')
    else toast.error(res.message ?? 'Place failed')
  }

  return (
    <div
      className={cn(
        'pointer-events-auto w-[min(340px,92vw)] rounded-2xl border shadow-2xl',
        PANEL_SHELL,
        'border-emerald-500/30 bg-[#0f1f1a]/90 text-emerald-50',
        className,
      )}
      role="dialog"
      aria-label="Confirm product placement"
    >
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-emerald-300/80 font-semibold">
            Place on shelf
          </p>
          <p className="text-sm font-semibold truncate text-white">{pending.name}</p>
          <p className="text-[11px] text-emerald-200/70 mt-0.5">
            {fillRemaining && fillPlan
              ? `Will fill free width × depth × height — ${fillPlan.quantity} unit${
                  fillPlan.quantity === 1 ? '' : 's'
                } (${fillPlan.facings}×${fillPlan.depthRows}×${fillPlan.stack}) · cavity ${shelfHint.remainingCm}×${shelfHint.depthCm}×${shelfHint.heightCm} cm`
              : `Places ${draft.facings}×${draft.depth}×${draft.stack} = ${qty} unit${
                  qty === 1 ? '' : 's'
                } only · free ${shelfHint.remainingCm}×${shelfHint.depthCm} cm`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => cancel()}
          className="rounded-lg p-1.5 text-emerald-200/70 hover:bg-white/10 hover:text-white"
          aria-label="Cancel placement"
        >
          <FiX size={16} />
        </button>
      </div>

      <div className="px-3.5 py-3 space-y-3">
        <Stepper
          label="Front facings"
          hint={`Across the shelf · max ${shelfHint.maxFacings}`}
          value={draft.facings}
          min={1}
          max={shelfHint.maxFacings}
          onChange={(facings) => updateQty({ facings })}
          disabled={isAttaching}
        />
        <Stepper
          label="Depth"
          hint={`Back into the shelf · max ${shelfHint.maxDepth}`}
          value={draft.depth}
          min={1}
          max={shelfHint.maxDepth}
          onChange={(depth) => updateQty({ depth })}
          disabled={isAttaching}
        />
        <Stepper
          label="Stack height"
          hint={
            stackable
              ? `Stacked up · max ${shelfHint.maxStack} (${shelfHint.heightCm} cm shelf)`
              : 'Not stackable'
          }
          value={stackable ? draft.stack : 1}
          min={1}
          max={stackable ? shelfHint.maxStack : 1}
          onChange={(stack) => updateQty({ stack })}
          disabled={isAttaching || !stackable}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">Add from</p>
            <p className="text-[10px] text-emerald-200/60">
              Click the left or right of the shelf — or pick an edge here
            </p>
          </div>
          <div className="flex rounded-lg border border-white/15 overflow-hidden shrink-0">
            <button
              type="button"
              disabled={isAttaching}
              onClick={() => updateQty({ anchor: 'left' })}
              className={cn(
                'px-2.5 py-1.5 text-[11px] font-semibold',
                (draft.anchor ?? 'left') === 'left'
                  ? 'bg-emerald-500 text-white'
                  : 'text-emerald-100/80 hover:bg-white/10',
              )}
            >
              Left
            </button>
            <button
              type="button"
              disabled={isAttaching}
              onClick={() => updateQty({ anchor: 'right' })}
              className={cn(
                'px-2.5 py-1.5 text-[11px] font-semibold',
                draft.anchor === 'right'
                  ? 'bg-emerald-500 text-white'
                  : 'text-emerald-100/80 hover:bg-white/10',
              )}
            >
              Right
            </button>
          </div>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-white/10 px-2.5 py-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 accent-emerald-500"
            checked={fillRemaining}
            disabled={isAttaching}
            onChange={(e) => updateQty({ fillRemaining: e.target.checked })}
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-white">Fill remaining shelf</span>
            <span className="block text-[10px] text-emerald-200/60 leading-snug">
              Off: place only the front × depth × stack above. On: fill the free
              shelf in width, depth, and height.
            </span>
          </span>
        </label>

        {draft.reason && (
          <p className="text-[11px] text-amber-200">{draft.reason}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => cancel()}
            disabled={isAttaching}
            className="flex-1 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-emerald-100/90 hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isAttaching || !draft.previewFits}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            <FiCheck size={14} />
            {isAttaching ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="text-[10px] text-emerald-200/60">{hint}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className="rounded-lg border border-white/15 p-1.5 hover:bg-white/10 disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          <FiMinus size={12} />
        </button>
        <span className="w-8 text-center text-sm font-bold tabular-nums">{value}</span>
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(value + 1)}
          className="rounded-lg border border-white/15 p-1.5 hover:bg-white/10 disabled:opacity-40"
          aria-label={`Increase ${label}`}
        >
          <FiPlus size={12} />
        </button>
      </div>
    </div>
  )
}
