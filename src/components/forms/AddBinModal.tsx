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
  error,
  onSubmit,
  isSubmitting,
}: AddBinModalProps) {
  const defaultW = rowWidthM && rowWidthM > 0 ? Math.max(0.1, (rowWidthM - occupiedWidthM) || rowWidthM * 0.25) : 0.35
  const defaultD = rowDepthM && rowDepthM > 0 ? rowDepthM * 0.9 : 0.35
  const defaultH = rowHeightM && rowHeightM > 0 ? Math.min(rowHeightM * 0.9, rowHeightM - 0.05) : 0.35

  const previewW = parseFloat(binWidth ?? '') || defaultW
  const previewD = parseFloat(binDepth ?? '') || defaultD
  const previewH = parseFloat(binHeight ?? '') || defaultH
  const showPreview = Boolean(rowWidthM && rowDepthM && rowHeightM)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Bin"
      subtitle="Provide bin name and dimensions (W × D × H in meters). Preview updates on the selected row."
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
          <FormField label="Depth (m)">
            <Input
              inputMode="decimal"
              value={binDepth ?? ''}
              placeholder={defaultD.toFixed(2)}
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
            rowDepthM={rowDepthM!}
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
