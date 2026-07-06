'use client'

import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'

interface AddRowModalProps {
  open: boolean
  onClose: () => void
  height: string
  onHeightChange: (v: string) => void
  onSubmit: () => void
  isSubmitting?: boolean
}

export function AddRowModal({
  open,
  onClose,
  height,
  onHeightChange,
  onSubmit,
  isSubmitting,
}: AddRowModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Row"
      subtitle="Row follows rack sides — two-sided racks get a row on both faces."
      maxWidth="md"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Adding…' : 'Add Row'}
          </Btn>
        </>
      }
    >
      <FormField label="Row Height (m)" required>
        <Input
          inputMode="decimal"
          value={height}
          placeholder="1.5"
          onChange={(e) => onHeightChange(e.target.value)}
        />
      </FormField>
    </Modal>
  )
}
