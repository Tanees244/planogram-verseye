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
      subtitle={`${rack.rackCode} — POST /racks/{id}/reflow (resize + fill capacity)`}
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
          <ReflowExceptionTray preview={preview} dark={false} />
        )}
      </div>
    </Modal>
  )
}
