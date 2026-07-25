'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { usePlanogramStore } from '@/store/planogramStore'

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return Boolean(el.closest('[contenteditable="true"]'))
}

/** Ctrl/Cmd+C / Ctrl/Cmd+V for SKU and row clipboard · Esc cancels placement modes. */
export function PlanogramClipboardHotkeys() {
  const copySelection = usePlanogramStore((s) => s.copySelection)
  const pasteClipboard = usePlanogramStore((s) => s.pasteClipboard)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isTypingTarget(e.target)) {
        const s = usePlanogramStore.getState()
        if (s.movingInventoryFromBinId) {
          s.cancelMovingBinInventory()
          toast('Move cancelled')
          return
        }
        if (s.isPlacingProduct || s.pendingProductParams) {
          s.cancelProductPlacement()
          toast('Product placement cancelled')
          return
        }
        if (s.isPlacingRack || s.pendingRackParams) {
          s.cancelFixturePlacement()
          toast('Fixture placement cancelled')
          return
        }
        if (s.editingRackId) {
          s.setEditingRackId(null)
          toast('Move cancelled')
          return
        }
        return
      }

      if (!(e.ctrlKey || e.metaKey)) return
      if (isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key !== 'c' && key !== 'v') return
      e.preventDefault()
      void (async () => {
        if (key === 'c') {
          const res = copySelection()
          if (res.success) toast.success(res.message ?? 'Copied')
          else toast.error(res.message ?? 'Nothing to copy')
          return
        }
        const res = await pasteClipboard()
        if (res.success) toast.success(res.message ?? 'Pasted')
        else toast.error(res.message ?? 'Paste failed')
      })()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [copySelection, pasteClipboard])

  return null
}
