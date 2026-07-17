'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'
import type {
  RackPublishPreviewResult,
  RackPublishResult,
  RackPublishStorePreview,
} from '@/types/rackPublish'
import { fetchPublishPreview, fetchPublishRack } from '@/utils/rackPublishApi'
import { getPlanogramTokenFromCookie } from '@verseye/utils'

interface StoreOption {
  id: string
  name: string
}

type Step = 'configure' | 'preview' | 'results'

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

function StorePreviewRow({ store, label }: { store: RackPublishStorePreview; label: string }) {
  const blocked = store.status === 'blocked'
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 text-sm',
        blocked ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900">{label}</span>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase px-2 py-0.5 rounded',
            blocked ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800',
          )}
        >
          {store.status}
        </span>
      </div>
      {store.rackPreview?.outer && (
        <p className="text-xs text-gray-600 mt-1">
          Outer{' '}
          {[
            store.rackPreview.outer.width,
            store.rackPreview.outer.depth,
            store.rackPreview.outer.height,
          ]
            .filter((v) => v != null)
            .map((v) => Number(v).toFixed(2))
            .join(' × ')}{' '}
          m
        </p>
      )}
      {store.warnings?.map((w, i) => (
        <p key={`w-${i}`} className="text-xs text-amber-700 mt-1">
          ⚠ {w}
        </p>
      ))}
      {store.errors?.map((e, i) => (
        <p key={`e-${i}`} className="text-xs text-red-700 mt-1">
          {e}
        </p>
      ))}
    </div>
  )
}

export function RackPublishModal({
  rack,
  open,
  onClose,
}: {
  rack: Rack
  open: boolean
  onClose: () => void
}) {
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const serverRackId = rack.rackId || rack.id

  const [step, setStep] = useState<Step>('configure')
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [rackCode, setRackCode] = useState(rack.rackCode || 'R-01')
  const [blueprintName, setBlueprintName] = useState(rack.blueprintName ?? rack.rackCode ?? '')
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([])
  const [preview, setPreview] = useState<RackPublishPreviewResult | null>(null)
  const [publishResult, setPublishResult] = useState<RackPublishResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const storeLabelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of stores) m.set(s.id, s.name)
    return m
  }, [stores])

  const fetchStores = useCallback(async () => {
    setLoadingStores(true)
    try {
      const res = await fetch('/api/locations/list?page=1&pageSize=100', { headers: authHeaders() })
      const json = await res.json().catch(() => ({}))
      const list = json?.data?.locations ?? []
      setStores(
        (Array.isArray(list) ? list : [])
          .filter((l: any) => l?.id && l.id !== selectedStoreId)
          .map((l: any) => ({
            id: l.id,
            name: l.locationCode ?? l.name ?? l.id,
          })),
      )
    } catch {
      setStores([])
    } finally {
      setLoadingStores(false)
    }
  }, [selectedStoreId])

  useEffect(() => {
    if (!open) return
    setStep('configure')
    setPreview(null)
    setPublishResult(null)
    setError(null)
    setRackCode(rack.rackCode || 'R-01')
    setBlueprintName(rack.blueprintName ?? rack.rackCode ?? '')
    setSelectedStoreIds([])
    void fetchStores()
  }, [open, rack.id, rack.rackCode, rack.blueprintName, fetchStores])

  const toggleStore = (id: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handlePreview = async () => {
    if (!rackCode.trim()) {
      setError('Rack code is required')
      return
    }
    if (selectedStoreIds.length === 0) {
      setError('Select at least one target store')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetchPublishPreview(serverRackId, {
        storeIds: selectedStoreIds,
        rackCode: rackCode.trim(),
        blueprintName: blueprintName.trim() || null,
      })
      if (!res.success || !res.data) {
        setError(res.message ?? 'Preview failed')
        return
      }
      setPreview(res.data)
      setStep('preview')
    } finally {
      setBusy(false)
    }
  }

  const handlePublish = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetchPublishRack(serverRackId, {
        storeIds: selectedStoreIds,
        rackCode: rackCode.trim(),
        blueprintName: blueprintName.trim() || null,
      })
      if (!res.success || !res.data) {
        setError(res.message ?? 'Publish failed')
        return
      }
      setPublishResult(res.data)
      setStep('results')
      // Pick up server-set publishedAt / lastUpdated on source + targets
      try {
        await usePlanogramStore.getState().reloadStoreLayout()
      } catch {
        /* non-fatal — results already shown */
      }
    } finally {
      setBusy(false)
    }
  }

  const readyCount = preview?.stores.filter((s) => s.status === 'ready').length ?? 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Publish rack to stores"
      subtitle="1:1 clone — shell, rows, bins, SKUs, POSM (no floor placement)"
      maxWidth="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Btn>
          {step === 'configure' && (
            <Btn variant="primary" onClick={handlePreview} disabled={busy || loadingStores}>
              {busy ? <Spinner /> : null}
              Preview publish
            </Btn>
          )}
          {step === 'preview' && (
            <>
              <Btn variant="secondary" onClick={() => setStep('configure')} disabled={busy}>
                Back
              </Btn>
              <Btn
                variant="primary"
                onClick={handlePublish}
                disabled={busy || readyCount === 0}
              >
                {busy ? <Spinner /> : null}
                Publish to {readyCount} store{readyCount === 1 ? '' : 's'}
              </Btn>
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {step === 'configure' && (
          <>
            <FormField label="Rack code in target stores" required>
              <Input
                value={rackCode}
                onChange={(e) => setRackCode(e.target.value)}
                placeholder="R-01"
              />
            </FormField>
            <FormField label="Blueprint display name">
              <Input
                value={blueprintName}
                onChange={(e) => setBlueprintName(e.target.value)}
                placeholder="Optional"
              />
            </FormField>
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Target stores</p>
              {loadingStores ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <Spinner /> Loading stores…
                </div>
              ) : stores.length === 0 ? (
                <p className="text-sm text-gray-500">No other stores available.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg p-2">
                  {stores.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStoreIds.includes(s.id)}
                        onChange={() => toggleStore(s.id)}
                        className="rounded border-gray-300"
                      />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              {readyCount} ready · {preview.stores.length - readyCount} blocked
            </p>
            {preview.stores.map((s) => (
              <StorePreviewRow
                key={s.storeId}
                store={s}
                label={storeLabelById.get(s.storeId) ?? s.storeId}
              />
            ))}
          </div>
        )}

        {step === 'results' && publishResult && (
          <div className="space-y-2">
            {publishResult.results.map((r) => (
              <div
                key={r.storeId}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm',
                  r.status === 'created'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50',
                )}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {storeLabelById.get(r.storeId) ?? r.storeId}
                  </span>
                  <span className="text-xs uppercase font-semibold">{r.status}</span>
                </div>
                {r.createdRackId && (
                  <p className="text-xs text-gray-600 mt-1 font-mono">Rack {r.createdRackId}</p>
                )}
                {r.errors?.map((e, i) => (
                  <p key={i} className="text-xs text-red-700 mt-1">
                    {e}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
