'use client'

import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'

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
  error,
  onSubmit,
  isSubmitting,
}: AddBinModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Bin"
      subtitle="Provide bin name and dimensions (W × D × H in meters)."
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
              placeholder="auto"
              onChange={(e) => onBinWidthChange?.(e.target.value)}
            />
          </FormField>
          <FormField label="Depth (m)">
            <Input
              inputMode="decimal"
              value={binDepth ?? ''}
              placeholder="auto"
              onChange={(e) => onBinDepthChange?.(e.target.value)}
            />
          </FormField>
          <FormField label="Height (m)">
            <Input
              inputMode="decimal"
              value={binHeight ?? ''}
              placeholder="auto"
              onChange={(e) => onBinHeightChange?.(e.target.value)}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  )
}
