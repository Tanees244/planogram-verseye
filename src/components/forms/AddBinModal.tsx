'use client'

import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { BinCreatePreview } from '@/components/BinCreatePreview'

interface AddBinModalProps {
  open: boolean
  onClose: () => void
  binName: string
  onBinNameChange: (v: string) => void
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
  const depthCap =
    maxBinDepthM && maxBinDepthM > 0
      ? maxBinDepthM
      : rowDepthM && rowDepthM > 0
        ? rowDepthM
        : 0.35
  const defaultW = rowWidthM && rowWidthM > 0 ? Math.max(0.1, (rowWidthM - occupiedWidthM) || rowWidthM * 0.25) : 0.35
  const defaultD = depthCap
  const defaultH = rowHeightM && rowHeightM > 0 ? Math.min(rowHeightM * 0.9, rowHeightM - 0.05) : 0.35

  const previewW = parseFloat(binWidth ?? '') || defaultW
  const previewD = Math.min(parseFloat(binDepth ?? '') || defaultD, depthCap)
  const previewH = parseFloat(binHeight ?? '') || defaultH
  const showPreview = Boolean(rowWidthM && rowDepthM && rowHeightM)
  const depthOverflow =
    Boolean(binDepth && parseFloat(binDepth) > depthCap + 1e-6)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Bin"
      subtitle="Name and size the bin (W × D × H in meters). You can leave it empty and attach SKUs afterward."
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
                Row: <strong>{rowWidthM!.toFixed(2)}</strong> W ×{' '}
                <strong>{depthCap.toFixed(2)}</strong> D ×{' '}
                <strong>{rowHeightM!.toFixed(2)}</strong> H m
              </span>
              <span className={occupiedWidthM > 0.001 ? '' : 'text-gray-500'}>
                Free width:{' '}
                <strong className="text-[#2C5282]">
                  {Math.max(0, rowWidthM! - occupiedWidthM).toFixed(2)} m
                </strong>
                {occupiedWidthM > 0.001 &&
                  ` (${occupiedWidthM.toFixed(2)} m used by existing bins)`}
              </span>
              <span className="text-gray-500">
                Max bin depth: <strong className="text-[#2C5282]">{depthCap.toFixed(2)} m</strong>
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
          <FormField label="Width (m)">
            <Input
              inputMode="decimal"
              value={binWidth ?? ''}
              placeholder={defaultW.toFixed(2)}
              onChange={(e) => onBinWidthChange?.(e.target.value)}
            />
          </FormField>
          <FormField
            label="Depth (m)"
            error={
              depthOverflow
                ? `Max ${depthCap.toFixed(2)} m for this rack`
                : undefined
            }
          >
            <Input
              inputMode="decimal"
              value={binDepth ?? ''}
              placeholder={defaultD.toFixed(2)}
              error={depthOverflow}
              onChange={(e) => onBinDepthChange?.(e.target.value)}
            />
          </FormField>
          <FormField label="Height (m)">
            <Input
              inputMode="decimal"
              value={binHeight ?? ''}
              placeholder={defaultH.toFixed(2)}
              onChange={(e) => onBinHeightChange?.(e.target.value)}
            />
          </FormField>
        </div>

        {showPreview && (
          <BinCreatePreview
            rowWidthM={rowWidthM!}
            rowDepthM={depthCap}
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
