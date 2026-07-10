import toast from 'react-hot-toast'

/** Pull a user-facing message from layout/catalog API JSON (`message` + `errors[]`). */
export function extractApiErrorMessage(data: unknown, fallback = 'Request failed'): string {
  if (!data || typeof data !== 'object') return fallback
  const d = data as Record<string, unknown>
  const errors = d.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const parts = errors
      .map((e) => {
        if (!e || typeof e !== 'object') return ''
        const err = e as Record<string, unknown>
        if (typeof err.message === 'string' && err.message.trim()) return err.message
        if (typeof err.field === 'string' && err.field.trim()) return err.field
        return ''
      })
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }
  if (typeof d.message === 'string' && d.message.trim()) return d.message
  return fallback
}

export function toastApiError(message: string | null | undefined, fallback = 'Request failed'): void {
  const text = message?.trim() || fallback
  toast.error(text, { duration: 6000 })
}
