'use client'

import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { BinCreatePreview } from '@/components/BinCreatePreview'

function cmToM(cm: number): number {
  return cm / 100
}

function mToCm(m: number): number {
  return m * 100
}

interface AddBinModalProps {
  open: boolean
  onClose: () => void
  binName: string
  onBinNameChange: (v: string) => void
  /** Width/depth/height input strings in centimeters. */
  binWidth?: string
  binDepth?: string
  binHeight?: string
  onBinWidthChange?: (v: string) => void
  onBinDepthChange?: (v: string) => void
  onBinHeightChange?: (v: string) => void
  /** Selected row dimensions for live preview (meters). */
  rowWidthM?: number
  rowDepthM?: number
  rowHeightM?: number
  occupiedWidthM?: number
  /** Max depth the API will accept for this rack/row (meters). */
  maxBinDepthM?: number
  error?: string | null
  onSubmit: () => void
  isSubmitting?: boolean
}

export function AddBinModal({
  open,
  onClose,
  binName,
  onBinNameChange,
  binWidth,
  binDepth,
  binHeight,
  onBinWidthChange,
  onBinDepthChange,
  onBinHeightChange,
  rowWidthM,
  rowDepthM,
  rowHeightM,
  occupiedWidthM = 0,
  maxBinDepthM,
  error,
  onSubmit,
  isSubmitting,
}: AddBinModalProps) {
  const depthCapM =
    maxBinDepthM && maxBinDepthM > 0
      ? maxBinDepthM
      : rowDepthM && rowDepthM > 0
        ? rowDepthM
        : 0.35
  const defaultWM =
    rowWidthM && rowWidthM > 0
      ? Math.max(0.1, (rowWidthM - occupiedWidthM) || rowWidthM * 0.25)
      : 0.35
  const defaultDM = depthCapM
  const defaultHM =
    rowHeightM && rowHeightM > 0 ? Math.min(rowHeightM * 0.9, rowHeightM - 0.05) : 0.35

  const defaultWCm = Math.round(mToCm(defaultWM))
  const defaultDCm = Math.round(mToCm(defaultDM))
  const defaultHCm = Math.round(mToCm(defaultHM))
  const depthCapCm = Math.round(mToCm(depthCapM) * 10) / 10

  const parsedWCm = parseFloat(binWidth ?? '')
  const parsedDCm = parseFloat(binDepth ?? '')
  const parsedHCm = parseFloat(binHeight ?? '')

  const previewW = cmToM(Number.isFinite(parsedWCm) && parsedWCm > 0 ? parsedWCm : defaultWCm)
  const previewD = Math.min(
    cmToM(Number.isFinite(parsedDCm) && parsedDCm > 0 ? parsedDCm : defaultDCm),
    depthCapM,
  )
  const previewH = cmToM(Number.isFinite(parsedHCm) && parsedHCm > 0 ? parsedHCm : defaultHCm)
  const showPreview = Boolean(rowWidthM && rowDepthM && rowHeightM)
  const depthOverflow =
    Number.isFinite(parsedDCm) && parsedDCm > depthCapCm + 0.05

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Bin"
      subtitle="Name and size the bin (W × D × H in centimeters). You can leave it empty and attach SKUs afterward."
      maxWidth="md"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Adding…' : 'Add Bin'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4 pt-1">
        {showPreview && (
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
              <span className={occupiedWidthM > 0.001 ? '' : 'text-gray-500'}>
                Free width:{' '}
                <strong className="text-[#2C5282]">
                  {Math.round(mToCm(Math.max(0, rowWidthM! - occupiedWidthM)))} cm
                </strong>
                {occupiedWidthM > 0.001 &&
                  ` (${Math.round(mToCm(occupiedWidthM))} cm used by existing bins)`}
              </span>
              <span className="text-gray-500">
                Max bin depth:{' '}
                <strong className="text-[#2C5282]">{depthCapCm} cm</strong>
              </span>
            </div>
          </div>
        )}
        <FormField label="Bin Name" required error={error}>
          <Input
            autoFocus
            placeholder="Enter bin name"
            value={binName}
            error={!!error}
            onChange={(e) => onBinNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isSubmitting && onSubmit()}
          />
        </FormField>
        <div className="grid grid-cols-3 gap-4 pt-1">
          <FormField label="Width (cm)">
            <Input
              inputMode="decimal"
              value={binWidth ?? ''}
              placeholder={String(defaultWCm)}
              onChange={(e) => onBinWidthChange?.(e.target.value)}
            />
          </FormField>
          <FormField
            label="Depth (cm)"
            error={
              depthOverflow
                ? `Max ${depthCapCm} cm for this rack`
                : undefined
            }
          >
            <Input
              inputMode="decimal"
              value={binDepth ?? ''}
              placeholder={String(defaultDCm)}
              error={depthOverflow}
              onChange={(e) => onBinDepthChange?.(e.target.value)}
            />
          </FormField>
          <FormField label="Height (cm)">
            <Input
              inputMode="decimal"
              value={binHeight ?? ''}
              placeholder={String(defaultHCm)}
              onChange={(e) => onBinHeightChange?.(e.target.value)}
            />
          </FormField>
        </div>

        {showPreview && (
          <BinCreatePreview
            rowWidthM={rowWidthM!}
            rowDepthM={depthCapM}
            rowHeightM={rowHeightM!}
            binWidthM={previewW}
            binDepthM={previewD}
            binHeightM={previewH}
            occupiedWidthM={occupiedWidthM}
          />
        )}
      </div>
    </Modal>
  )
}
