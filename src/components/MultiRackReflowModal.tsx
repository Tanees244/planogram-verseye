'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { Modal } from '@/components/ui/Modal'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { ReflowExceptionTray } from '@/components/ReflowExceptionTray'
import { cn } from '@/lib/cn'
import type { MultiRackReflowResponse, MultiRackReflowTargetResult } from '@/types/rackReflow'
import {
  fetchApplyMultiRackReflow,
  fetchMultiRackReflowPreview,
} from '@/utils/rackReflowApi'
import { getPlanogramTokenFromCookie } from '@verseye/utils'

type Step = 'select' | 'preview' | 'results'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface StoreOption {
  id: string
  name: string
}

interface TargetRackOption {
  id: string
  rackCode: string
  width?: number | null
  depth?: number | null
  storeId: string
  storeName: string
}

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

function extractRackList(payload: unknown): any[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  const obj = payload as Record<string, unknown>
  if (Array.isArray(obj.items)) return obj.items
  if (Array.isArray(obj.racks)) return obj.racks
  if (Array.isArray(obj.results)) return obj.results
  if (obj.data && typeof obj.data === 'object') return extractRackList(obj.data)
  return []
}

function statusChip(status: MultiRackReflowTargetResult['status']) {
  switch (status) {
    case 'ready':
    case 'applied':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'needsAttention':
      return 'bg-amber-100 text-amber-900 border-amber-200'
    case 'blocked':
    default:
      return 'bg-red-100 text-red-800 border-red-200'
  }
}

function TargetCard({
  target,
  label,
}: {
  target: MultiRackReflowTargetResult
  label: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-900 text-sm">{label}</div>
          <div className="text-[11px] text-gray-500 font-mono mt-0.5">{target.rackId}</div>
        </div>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase px-2 py-0.5 rounded border',
            statusChip(target.status),
          )}
        >
          {target.status}
        </span>
      </div>

      {target.outer && (
        <p className="text-xs text-gray-600">
          Outer{' '}
          {[target.outer.width, target.outer.depth, target.outer.height]
            .filter((v) => v != null)
            .map((v) => Number(v).toFixed(2))
            .join(' × ')}{' '}
          m (kept on target)
        </p>
      )}

      {target.errors?.map((e, i) => (
        <p key={`e-${i}`} className="text-xs text-red-700">
          {e}
        </p>
      ))}
      {target.warnings?.map((w, i) => (
        <p key={`w-${i}`} className="text-xs text-amber-700">
          ⚠ {w}
        </p>
      ))}

      {(target.exceptions.length > 0 ||
        target.quantityChanges.length > 0 ||
        target.geometryChanges.length > 0) && (
        <ReflowExceptionTray preview={target} title={`${label} reflow impact`} />
      )}
    </div>
  )
}

export function MultiRackReflowModal({
  rack,
  open,
  onClose,
}: {
  rack: Rack
  open: boolean
  onClose: () => void
}) {
  const areaRacks = usePlanogramStore((s) => s.area.racks)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)
  const reloadStoreLayout = usePlanogramStore((s) => s.reloadStoreLayout)
  const copyPosmFromRackToRack = usePlanogramStore((s) => s.copyPosmFromRackToRack)
  const applyFaceFillToRack = usePlanogramStore((s) => s.applyFaceFillToRack)
  const ensureBinsAndFaceFillAfterReflow = usePlanogramStore(
    (s) => s.ensureBinsAndFaceFillAfterReflow,
  )
  const sourceRackId = rack.rackId || rack.id

  const [step, setStep] = useState<Step>('select')
  const [stores, setStores] = useState<StoreOption[]>([])
  const [targetStoreId, setTargetStoreId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<TargetRackOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [loadingRacks, setLoadingRacks] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [preview, setPreview] = useState<MultiRackReflowResponse | null>(null)
  const [result, setResult] = useState<MultiRackReflowResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of areaRacks) m.set(r.rackId || r.id, r.rackCode || r.id)
    for (const r of candidates) m.set(r.id, `${r.rackCode} (${r.storeName})`)
    return m
  }, [areaRacks, candidates])

  const fetchStores = useCallback(async () => {
    setLoadingStores(true)
    try {
      const res = await fetch('/api/locations/list?page=1&pageSize=200', {
        headers: authHeaders(),
      })
      const json = await res.json().catch(() => ({}))
      const list = json?.data?.locations ?? []
      const mapped: StoreOption[] = (Array.isArray(list) ? list : [])
        .filter((l: any) => l?.id)
        .map((l: any) => ({
          id: String(l.id),
          name: String(l.locationCode ?? l.name ?? l.id),
        }))
      setStores(mapped)
      setTargetStoreId((prev) => prev ?? selectedStoreId ?? mapped[0]?.id ?? null)
    } catch {
      setStores([])
    } finally {
      setLoadingStores(false)
    }
  }, [selectedStoreId])

  const fetchTargetRacks = useCallback(
    async (storeId: string) => {
      setLoadingRacks(true)
      setError(null)
      try {
        const storeName =
          stores.find((s) => s.id === storeId)?.name ??
          (storeId === selectedStoreId ? selectedStoreName : null) ??
          storeId

        // Prefer live editor racks when targeting the open store (freshest + dimensions).
        // Only server UUID racks can be Kind-C targets — local-only ids must not appear
        // (sending them used to look like "reflow created a different rack").
        if (storeId === selectedStoreId && areaRacks.length > 0) {
          setCandidates(
            areaRacks
              .map((r) => ({
                id: r.rackId || r.id,
                rackCode: r.rackCode || r.id,
                width: r.width,
                depth: r.depth,
                storeId,
                storeName: storeName || 'Current store',
              }))
              .filter((r) => UUID_RE.test(r.id) && r.id !== sourceRackId),
          )
          return
        }

        const res = await fetch(
          `/api/racks/by-store/${encodeURIComponent(storeId)}?page=1&pageSize=200`,
          { headers: authHeaders() },
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json?.isRequestSuccess === false) {
          setCandidates([])
          setError(json?.message || 'Failed to load racks for store')
          return
        }
        const list = extractRackList(json?.data ?? json)
        setCandidates(
          list
            .map((raw: any) => {
              const id = String(raw.rackId ?? raw.id ?? '')
              return {
                id,
                rackCode: String(raw.rackCode ?? raw.rack_code ?? id),
                width: raw.outer?.width ?? raw.width ?? null,
                depth: raw.outer?.depth ?? raw.depth ?? null,
                storeId,
                storeName: storeName || storeId,
              }
            })
            .filter(
              (r: TargetRackOption) =>
                UUID_RE.test(r.id) && r.id !== sourceRackId,
            ),
        )
      } catch {
        setCandidates([])
        setError('Network error loading target racks')
      } finally {
        setLoadingRacks(false)
      }
    },
    [areaRacks, selectedStoreId, selectedStoreName, sourceRackId, stores],
  )

  useEffect(() => {
    if (!open) return
    setStep('select')
    setSelectedIds([])
    setPreview(null)
    setResult(null)
    setError(null)
    setCandidates([])
    void fetchStores()
  }, [open, sourceRackId, fetchStores])

  useEffect(() => {
    if (!open || !targetStoreId) return
    setSelectedIds([])
    void fetchTargetRacks(targetStoreId)
  }, [open, targetStoreId, fetchTargetRacks])

  const toggleTarget = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const runPreview = useCallback(async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one target rack')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetchMultiRackReflowPreview(sourceRackId, {
        targetRackIds: selectedIds,
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
  }, [selectedIds, sourceRackId])

  const runApply = useCallback(async () => {
    if (selectedIds.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetchApplyMultiRackReflow(sourceRackId, {
        targetRackIds: selectedIds,
      })
      if (!res.success || !res.data) {
        setError(res.message ?? 'Apply failed')
        return
      }
      setResult(res.data)
      setStep('results')
      await reloadStoreLayout()

      // Soft-copy POSM + local face fill for targets that live in this scene.
      const warnings: string[] = []
      for (const t of res.data.targets ?? []) {
        if (t.status === 'blocked') continue
        const posm = await copyPosmFromRackToRack(rack.id, t.rackId)
        if (!posm.success && posm.message) warnings.push(posm.message)
        applyFaceFillToRack(t.rackId)
        void ensureBinsAndFaceFillAfterReflow(t.rackId)
      }
      applyFaceFillToRack(rack.id)
      void ensureBinsAndFaceFillAfterReflow(rack.id)
      if (warnings.length) {
        setError(`Reflow applied. POSM copy notes: ${warnings.slice(0, 2).join(' · ')}`)
      }
    } finally {
      setBusy(false)
    }
  }, [
    selectedIds,
    sourceRackId,
    reloadStoreLayout,
    copyPosmFromRackToRack,
    applyFaceFillToRack,
    ensureBinsAndFaceFillAfterReflow,
    rack.id,
  ])

  const targets = (step === 'results' ? result?.targets : preview?.targets) ?? []
  const canApply =
    step === 'preview' &&
    (preview?.targets.some((t) => t.status === 'ready' || t.status === 'needsAttention') ??
      false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply multi-rack reflow"
      subtitle={`Source: ${rack.rackCode}`}
      maxWidth="3xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Btn variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Btn>
          {step === 'preview' && (
            <Btn variant="secondary" onClick={() => setStep('select')} disabled={busy}>
              Back
            </Btn>
          )}
          {step === 'select' && (
            <Btn
              variant="primary"
              onClick={runPreview}
              disabled={busy || selectedIds.length === 0 || loadingRacks}
            >
              {busy ? <Spinner /> : null}
              Preview reflow
            </Btn>
          )}
          {step === 'preview' && (
            <Btn variant="primary" onClick={runApply} disabled={busy || !canApply}>
              {busy ? <Spinner /> : null}
              Apply to eligible targets
            </Btn>
          )}
        </div>
      }
    >
      <div className="space-y-4 p-1">
        <p className="text-sm text-gray-600">
          Pick <strong>existing</strong> target racks in this store or another. Targets keep their
          own outer size and floor placement; source SKU/bin topology is mapped and facings
          reflow onto those fixtures. This does <strong>not</strong> create new racks — use{' '}
          <strong>Publish to stores</strong> only when you intentionally want to clone a new
          fixture into another store.
        </p>
        {!UUID_RE.test(sourceRackId) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Source rack has no server id yet. Place/save it on the floor first before multi-rack
            reflow.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Target store
              </label>
              {loadingStores ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                  <Spinner /> Loading stores…
                </div>
              ) : (
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={targetStoreId ?? ''}
                  onChange={(e) => setTargetStoreId(e.target.value || null)}
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.id === selectedStoreId ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {loadingRacks ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-8">
                  <Spinner /> Loading racks…
                </div>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No other racks in this store. Choose another store, or place a second rack
                  first — Kind C needs an existing target fixture.
                </p>
              ) : (
                candidates.map((r) => {
                  const checked = selectedIds.includes(r.id)
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer',
                        checked
                          ? 'border-brand bg-brand/5'
                          : 'border-gray-200 hover:bg-gray-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTarget(r.id)}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {r.rackCode}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {r.storeName}
                          {r.width != null && r.depth != null
                            ? ` · ${Number(r.width).toFixed(2)} × ${Number(r.depth).toFixed(2)} m`
                            : ''}
                        </div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        )}

        {(step === 'preview' || step === 'results') && (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {targets.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No target results.</p>
            ) : (
              targets.map((t) => (
                <TargetCard
                  key={t.rackId}
                  target={t}
                  label={labelById.get(t.rackId) ?? t.rackId}
                />
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
