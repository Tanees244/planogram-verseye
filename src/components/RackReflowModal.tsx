'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { Modal } from '@/components/ui/Modal'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { ReflowExceptionTray } from '@/components/ReflowExceptionTray'
import type { RackReflowPreview } from '@/types/rackReflow'
import {
  buildReflowBodyFromRack,
  fetchApplyReflow,
  fetchReflowPreview,
} from '@/utils/rackReflowApi'
import { resolveRackOuter } from '@/utils/rackBlueprintMapper'

export function RackReflowModal({
  rack,
  open,
  onClose,
}: {
  rack: Rack
  open: boolean
  onClose: () => void
}) {
  const reloadStoreLayout = usePlanogramStore((s) => s.reloadStoreLayout)
  const saveRackLayout = usePlanogramStore((s) => s.saveRackLayoutToServer)

  const [preview, setPreview] = useState<RackReflowPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useReflowOnSave, setUseReflowOnSave] = useState(true)

  const serverRackId = rack.rackId || rack.id
  const outer = resolveRackOuter(rack)
  const reflowBody = useMemo(() => buildReflowBodyFromRack(rack), [rack])

  const runPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchReflowPreview(serverRackId, reflowBody)
      if (!res.success || !res.data) {
        setError(res.message ?? 'Preview failed')
        setPreview(null)
        return
      }
      setPreview(res.data)
    } finally {
      setLoading(false)
    }
  }, [serverRackId, reflowBody])

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setError(null)
      return
    }
    void runPreview()
  }, [open, runPreview])

  const handleApplyReflow = async () => {
    setApplying(true)
    setError(null)
    try {
      const res = await fetchApplyReflow(serverRackId, reflowBody)
      if (!res.success) {
        setError(res.message ?? 'Apply failed')
        return
      }
      await reloadStoreLayout()
      onClose()
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
      onClose()
    } finally {
      setApplying(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resize reflow preview"
      subtitle={`${rack.rackCode} · outer ${outer.width.toFixed(2)} × ${outer.depth.toFixed(2)} × ${outer.height.toFixed(2)} m`}
      maxWidth="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={applying}>
            Cancel
          </Btn>
          <Btn variant="secondary" onClick={runPreview} disabled={loading || applying}>
            {loading ? <Spinner /> : null}
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
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 leading-snug">
          Server reflow rescales rows/bins and adjusts SKU quantities. Items that no longer fit
          remain attached and appear in the exception tray below.
        </p>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={useReflowOnSave}
            onChange={(e) => setUseReflowOnSave(e.target.checked)}
            className="rounded border-gray-300"
          />
          Include <code className="text-xs bg-gray-100 px-1 rounded">reflowSkus: true</code> on
          full layout save
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {loading && !preview ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
            <Spinner /> Loading reflow preview…
          </div>
        ) : (
          <ReflowExceptionTray preview={preview} dark={false} />
        )}
      </div>
    </Modal>
  )
}
