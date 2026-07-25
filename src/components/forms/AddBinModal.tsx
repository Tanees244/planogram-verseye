'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import {
  RowBinLayoutEditor,
  createInitialDraft,
  type DraftBinLayout,
} from '@/components/RowBinLayoutEditor'

function cmToM(cm: number): number {
  return cm / 100
}

function mToCm(m: number): number {
  return m * 100
}

export type AddBinDraftPayload = {
  name: string
  widthM: number
  depthM: number
  heightM: number
}

interface AddBinModalProps {
  open: boolean
  onClose: () => void
  /** Selected row dimensions for live preview (meters). */
  rowWidthM?: number
  rowDepthM?: number
  rowHeightM?: number
  occupiedWidthM?: number
  /** Existing bins on the row (shown locked in the editor). */
  existingBins?: { id: string; name?: string; widthM: number; heightM?: number }[]
  /** Max depth the API will accept for this rack/row (meters). */
  maxBinDepthM?: number
  error?: string | null
  /** Create all draft bins left→right on the row. */
  onSaveBins: (bins: AddBinDraftPayload[]) => void | Promise<void>
  isSubmitting?: boolean
}

export function AddBinModal({
  open,
  onClose,
  rowWidthM,
  rowDepthM,
  rowHeightM,
  occupiedWidthM = 0,
  existingBins = [],
  maxBinDepthM,
  error,
  onSaveBins,
  isSubmitting,
}: AddBinModalProps) {
  const depthCapM =
    maxBinDepthM && maxBinDepthM > 0
      ? maxBinDepthM
      : rowDepthM && rowDepthM > 0
        ? rowDepthM
        : 0.35
  const freeM = Math.max(0, (rowWidthM ?? 0) - occupiedWidthM)

  const [drafts, setDrafts] = useState<DraftBinLayout[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (!(rowWidthM && rowHeightM && freeM > 0.08)) {
      setDrafts([])
      setSelectedId(null)
      return
    }
    const first = createInitialDraft(freeM, depthCapM, rowHeightM, existingBins.length + 1)
    setDrafts([first])
    setSelectedId(first.id)
  }, [open, rowWidthM, rowHeightM, depthCapM, freeM, existingBins.length])

  const selected = drafts.find((d) => d.id === selectedId) ?? null

  const updateSelected = (patch: Partial<DraftBinLayout>) => {
    if (!selected) return
    setDrafts((prev) =>
      prev.map((d) => (d.id === selected.id ? { ...d, ...patch } : d)),
    )
  }

  const draftUsed = drafts.reduce((s, d) => s + d.widthM, 0)
  const canSave =
    drafts.length > 0 &&
    draftUsed <= freeM + 0.002 &&
    drafts.every((d) => d.widthM > 0.05 && d.heightM > 0.05 && d.depthM > 0.05) &&
    !isSubmitting

  const depthCapCm = Math.round(mToCm(depthCapM) * 10) / 10
  const showEditor = Boolean(rowWidthM && rowDepthM && rowHeightM)

  const selectedWCm = selected ? String(Math.round(mToCm(selected.widthM))) : ''
  const selectedDCm = selected ? String(Math.round(mToCm(selected.depthM))) : ''
  const selectedHCm = selected ? String(Math.round(mToCm(selected.heightM))) : ''

  const footerLabel = useMemo(() => {
    if (isSubmitting) return 'Saving…'
    if (drafts.length <= 1) return 'Save bin'
    return `Save ${drafts.length} bins`
  }, [drafts.length, isSubmitting])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add bins on row"
      subtitle="Lay out boxes on the free strip — drag to reorder, edges to resize. Save creates them on this row."
      maxWidth="2xl"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            disabled={!canSave}
            onClick={() => {
              void onSaveBins(
                drafts.map((d) => ({
                  name: d.name.trim() || 'Bay',
                  widthM: d.widthM,
                  depthM: Math.min(d.depthM, depthCapM),
                  heightM: d.heightM,
                })),
              )
            }}
          >
            {isSubmitting && <Spinner />}
            {footerLabel}
          </Btn>
        </>
      }
    >
      <div className="space-y-4 pt-1">
        {showEditor && (
          <div className="rounded-xl border border-[#2C5282]/20 bg-[#2C5282]/5 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#2C5282]/70 mb-1">
              Selected row space
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700">
              <span>
                Row:{' '}
                <strong>{Math.round(mToCm(rowWidthM!))}</strong> W ×{' '}
                <strong>{Math.round(mToCm(depthCapM))}</strong> D ×{' '}
                <strong>{Math.round(mToCm(rowHeightM!))}</strong> H cm
              </span>
              <span>
                Free width:{' '}
                <strong className="text-[#2C5282]">{Math.round(mToCm(freeM))} cm</strong>
              </span>
              <span className="text-gray-500">
                Max depth: <strong className="text-[#2C5282]">{depthCapCm} cm</strong>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {showEditor ? (
          <RowBinLayoutEditor
            rowWidthM={rowWidthM!}
            rowHeightM={rowHeightM!}
            rowDepthM={depthCapM}
            existingBins={existingBins}
            drafts={drafts}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={setDrafts}
          />
        ) : (
          <p className="text-sm text-gray-500">Select a row in the scene to lay out bins.</p>
        )}

        {selected && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FormField label="Bin name">
              <Input
                value={selected.name}
                onChange={(e) => updateSelected({ name: e.target.value })}
              />
            </FormField>
            <FormField label="Width (cm)">
              <Input
                inputMode="decimal"
                value={selectedWCm}
                onChange={(e) => {
                  const cm = parseFloat(e.target.value)
                  if (!Number.isFinite(cm) || cm <= 0) return
                  const others = drafts
                    .filter((d) => d.id !== selected.id)
                    .reduce((s, d) => s + d.widthM, 0)
                  const maxW = Math.max(0.08, freeM - others - 0.001)
                  updateSelected({
                    widthM: Math.min(maxW, Math.max(0.08, cmToM(cm))),
                  })
                }}
              />
            </FormField>
            <FormField label="Depth (cm)">
              <Input
                inputMode="decimal"
                value={selectedDCm}
                onChange={(e) => {
                  const cm = parseFloat(e.target.value)
                  if (!Number.isFinite(cm) || cm <= 0) return
                  updateSelected({
                    depthM: Math.min(depthCapM, Math.max(0.08, cmToM(cm))),
                  })
                }}
              />
            </FormField>
            <FormField label="Height (cm)">
              <Input
                inputMode="decimal"
                value={selectedHCm}
                onChange={(e) => {
                  const cm = parseFloat(e.target.value)
                  if (!Number.isFinite(cm) || cm <= 0) return
                  updateSelected({
                    heightM: Math.min(
                      (rowHeightM ?? 1) - 0.01,
                      Math.max(0.08, cmToM(cm)),
                    ),
                  })
                }}
              />
            </FormField>
          </div>
        )}
      </div>
    </Modal>
  )
}
