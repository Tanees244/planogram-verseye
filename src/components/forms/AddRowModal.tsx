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
  /** Usable body height (m) — when set, changing count auto-fills equal row heights. */
  availableHeightM?: number
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
  availableHeightM,
  onSubmit,
  isSubmitting,
}: AddRowModalProps) {
  const n = Math.max(1, Math.min(20, Math.floor(Number(count) || 1)))
  const autoH =
    availableHeightM != null && availableHeightM > 0
      ? Number((availableHeightM / n).toFixed(3))
      : null

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
          hint={
            autoH != null
              ? `Equal heights: ${availableHeightM!.toFixed(2)} m ÷ ${n} = ${autoH} m each`
              : 'Add multiple shelves at once (max 20). Stops if the rack runs out of height.'
          }
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
              if (v === '' || /^\d+$/.test(v)) {
                onCountChange?.(v)
                if (availableHeightM != null && availableHeightM > 0) {
                  const nextN = Math.max(1, Math.min(20, Math.floor(Number(v) || 1)))
                  onHeightChange(String(Number((availableHeightM / nextN).toFixed(3))))
                }
              }
            }}
          />
        </FormField>
        <FormField
          label="Row Height (m)"
          required
          hint={
            autoH != null
              ? 'Auto-filled from available height ÷ number of rows (you can override)'
              : 'Height for each new row'
          }
        >
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
