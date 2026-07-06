'use client'

import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'

interface AddBinModalProps {
  open: boolean
  onClose: () => void
  binName: string
  onBinNameChange: (v: string) => void
  error?: string | null
  onSubmit: () => void
  isSubmitting?: boolean
}

export function AddBinModal({
  open,
  onClose,
  binName,
  onBinNameChange,
  error,
  onSubmit,
  isSubmitting,
}: AddBinModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Bin"
      subtitle="Bin width is split evenly across the row. Name it for easy identification."
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
    </Modal>
  )
}
