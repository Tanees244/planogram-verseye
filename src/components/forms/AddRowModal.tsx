'use client'

import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'

interface AddRowModalProps {
  open: boolean
  onClose: () => void
  height: string
  onHeightChange: (v: string) => void
  /** Number of rows to add at once (default 1). */
  count?: string
  onCountChange?: (v: string) => void
  onSubmit: () => void
  isSubmitting?: boolean
}

export function AddRowModal({
  open,
  onClose,
  height,
  onHeightChange,
  count = '1',
  onCountChange,
  onSubmit,
  isSubmitting,
}: AddRowModalProps) {
  const n = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)))

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
            {isSubmitting ? 'Adding…' : n > 1 ? `Add ${n} rows` : 'Add Row'}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <FormField
          label="Number of rows"
          hint="Add multiple shelves at once (max 20). Stops if the rack runs out of height."
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            step={1}
            value={count}
            onChange={(e) => {
              const v = e.target.value
              if (v === '' || /^\d+$/.test(v)) onCountChange?.(v)
            }}
          />
        </FormField>
        <FormField label="Row Height (m)" required hint="Height for each new row">
          <Input
            inputMode="decimal"
            value={height}
            placeholder="0.4"
            onChange={(e) => onHeightChange(e.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  )
}
