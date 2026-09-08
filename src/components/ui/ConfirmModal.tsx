'use client'

import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose()
      }}
      title={title}
      maxWidth="sm"
      hideClose={busy}
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand hover:bg-brand-dark',
            )}
          >
            {busy ? <Spinner /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </Modal>
  )
}
