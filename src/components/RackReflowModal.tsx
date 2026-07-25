'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { Modal } from '@/components/ui/Modal'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { ReflowExceptionTray } from '@/components/ReflowExceptionTray'
import type { RackReflowResult } from '@/types/rackReflow'
import {
  buildReflowBodyFromRack,
  fetchApplyReflow,
  fetchReflowPreview,
} from '@/utils/rackReflowApi'
import { displayRackName } from '@/utils/displayRackName'
import { cn } from '@/lib/cn'
import type { ShelfRowUtilization } from '@/types/shelfUtilization'

function RowUtilizationBars({ rows }: { rows?: ShelfRowUtilization[] }) {
  if (!rows || rows.length === 0) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        Per-row utilization
      </p>
      {rows.map((ru, i) => {
        const label =
          ru.rowNumber != null ? `Row ${ru.rowNumber}` : ru.rowId || `Row ${i + 1}`
        const u = ru.utilization
        if (!u.canCalculate || u.status === 'dimensions_unavailable') {
          return (
            <div key={ru.rowId || i} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-gray-600">{label}</span>
              <span className="text-gray-400">Unable to calculate</span>
            </div>
          )
        }
        const pct = Math.round(u.utilizationPercent)
        return (
          <div key={ru.rowId || i} className="space-y-0.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-gray-600">{label}</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  u.isOverCapacity ? 'text-red-600' : 'text-gray-800',
                )}
              >
                {pct}%{u.isOverCapacity ? ' over' : ''}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
              <div
                className={cn(
                  'h-full rounded-full',
                  u.isOverCapacity
                    ? 'bg-red-500'
                    : pct >= 95
                      ? 'bg-emerald-500'
                      : pct >= 70
                        ? 'bg-sky-500'
                        : pct >= 40
                          ? 'bg-amber-500'
                          : 'bg-red-400',
                )}
                style={{ width: `${Math.max(2, Math.min(100, u.utilizationPercent))}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RackReflowModal({
  rack,
  open,
  onClose,
}: {
  rack: Rack
  open: boolean
  onClose: () => void
}) {
  const saveRackLayout = usePlanogramStore((s) => s.saveRackLayoutToServer)
  const reloadStoreLayout = usePlanogramStore((s) => s.reloadStoreLayout)
  const ensureBinsAndFaceFillAfterReflow = usePlanogramStore(
    (s) => s.ensureBinsAndFaceFillAfterReflow,
  )
  const serverRackId = rack.rackId || rack.id

  const [preview, setPreview] = useState<RackReflowResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useReflowOnSave, setUseReflowOnSave] = useState(true)

  const reflowBody = useMemo(() => buildReflowBodyFromRack(rack), [rack])

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchReflowPreview(serverRackId, reflowBody)
      if (!res.success || !res.data) {
        setPreview(null)
        setError(res.message ?? 'Reflow preview failed')
        return
      }
      setPreview(res.data)
    } finally {
      setLoading(false)
    }
  }, [serverRackId, reflowBody])

  useEffect(() => {
    if (!open) return
    setPreview(null)
    setError(null)
    void loadPreview()
  }, [open, loadPreview])

  const handleApplyReflow = async () => {
    setApplying(true)
    setError(null)
    try {
      const res = await fetchApplyReflow(serverRackId, reflowBody)
      if (!res.success) {
        setError(res.message ?? 'Reflow apply failed')
        return
      }
      if (res.data) setPreview(res.data)
      await reloadStoreLayout()
      await ensureBinsAndFaceFillAfterReflow(rack.id)
    } finally {
      setApplying(false)
    }
  }

  const handleSaveWithReflow = async () => {
    setApplying(true)
    setError(null)
    try {
      const res = await saveRackLayout(rack.id, { reflowSkus: useReflowOnSave })
      if (!res.success) {
        setError(res.message ?? 'Save failed')
        return
      }
      await reloadStoreLayout()
      await ensureBinsAndFaceFillAfterReflow(rack.id)
      onClose()
    } finally {
      setApplying(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply rack reflow"
      subtitle={`${displayRackName(rack)} — POST /racks/{id}/reflow (resize + fill capacity)`}
      maxWidth="2xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Btn variant="secondary" onClick={onClose} disabled={applying}>
            Close
          </Btn>
          <Btn variant="secondary" onClick={loadPreview} disabled={loading || applying}>
            Refresh preview
          </Btn>
          <Btn variant="secondary" onClick={handleSaveWithReflow} disabled={applying || loading}>
            {applying ? <Spinner /> : null}
            Save layout{useReflowOnSave ? ' + reflow SKUs' : ''}
          </Btn>
          <Btn variant="primary" onClick={handleApplyReflow} disabled={applying || loading}>
            {applying ? <Spinner /> : null}
            Apply reflow
          </Btn>
        </div>
      }
    >
      <div className="space-y-4 p-1">
        <p className="text-sm text-gray-600">
          Server reflow rescales rows/bins and fills SKU quantities to the new capacity. Products that
          no longer fit stay on the bin with qty 0 and appear as exceptions — they are not detached.
        </p>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={useReflowOnSave}
            onChange={(e) => setUseReflowOnSave(e.target.checked)}
          />
          Include <code className="text-xs bg-gray-100 px-1 rounded">reflowSkus: true</code> on
          save (Kind B shortcut — no change DTO returned)
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600 py-6 justify-center">
            <Spinner /> Loading reflow preview…
          </div>
        ) : (
          <>
            <RowUtilizationBars rows={preview?.rowUtilizations} />
            <ReflowExceptionTray preview={preview} dark={false} />
          </>
        )}
      </div>
    </Modal>
  )
}
