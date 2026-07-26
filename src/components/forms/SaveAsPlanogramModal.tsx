'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FiCamera, FiImage, FiX } from 'react-icons/fi'
import type { Rack } from '@/store/planogramStore'
import { Modal } from '@/components/ui/Modal'
import { Btn, FormField, Input } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { displayRackName } from '@/utils/displayRackName'
import {
  resolveRackSideShelfId,
  updateShelfName,
  uploadShelfIdealImage,
} from '@/utils/saveShelfPlanogramApi'

export type SaveAsPlanogramModalProps = {
  open: boolean
  onClose: () => void
  rack: Rack
  /** Persist current rack layout before naming / photo. */
  onSaveLayout?: () => Promise<{ success: boolean; message?: string }>
  onSuccess?: (info: { shelfId: string; name: string }) => void
}

export function SaveAsPlanogramModal({
  open,
  onClose,
  rack,
  onSaveLayout,
  onSuccess,
}: SaveAsPlanogramModalProps) {
  const sides = rack.sides
  const [sideId, setSideId] = useState(sides[0]?.sideId ?? sides[0]?.id ?? '')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveLayoutFirst, setSaveLayoutFirst] = useState(true)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const selectedSide = useMemo(
    () => sides.find((s) => s.sideId === sideId || s.id === sideId) ?? sides[0],
    [sides, sideId],
  )

  useEffect(() => {
    if (!open) return
    const first = sides[0]
    setSideId(first?.sideId ?? first?.id ?? '')
    const code = first?.sideCode ? ` · ${first.sideCode}` : ''
    setName(`${displayRackName(rack)}${code}`.trim())
    setFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setError(null)
    setSaveLayoutFirst(true)
    setBusy(false)
  }, [open, rack, sides])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const pickFile = (next: File | null | undefined) => {
    if (!next) return
    if (!next.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPEG, or WebP).')
      return
    }
    setError(null)
    setFile(next)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(next)
    })
  }

  const canSubmit = Boolean(name.trim()) && Boolean(file) && !busy && sides.length > 0

  const handleSubmit = async () => {
    if (!canSubmit || !file || !selectedSide) return
    setBusy(true)
    setError(null)
    try {
      if (saveLayoutFirst && onSaveLayout) {
        const layout = await onSaveLayout()
        if (!layout.success) {
          setError(layout.message ?? 'Failed to save rack layout')
          return
        }
      }

      let shelfId = selectedSide.shelfId?.trim() || ''
      if (!shelfId) {
        const resolved = await resolveRackSideShelfId(
          rack.rackId || rack.id,
          selectedSide.sideId || selectedSide.id,
        )
        if (!resolved.success || !resolved.shelfId) {
          setError(resolved.message ?? 'No shelf linked to this rack face')
          return
        }
        shelfId = resolved.shelfId
      }

      const named = await updateShelfName(shelfId, name.trim())
      if (!named.success) {
        setError(named.message ?? 'Failed to save name')
        return
      }

      const imaged = await uploadShelfIdealImage(shelfId, file)
      if (!imaged.success) {
        setError(imaged.message ?? 'Failed to upload ideal image')
        return
      }

      onSuccess?.({ shelfId, name: name.trim() })
      onClose()
    } catch {
      setError('Could not connect to server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose()
      }}
      title="Save as planogram"
      subtitle="Name this shelf face and attach an ideal photo of the rack."
      maxWidth="md"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {busy && <Spinner />}
            {busy ? 'Saving…' : 'Save planogram'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4 pt-1">
        {sides.length > 1 && (
          <FormField label="Rack face" hint="Each side has its own shelf / planogram.">
            <select
              value={selectedSide?.sideId ?? selectedSide?.id ?? ''}
              onChange={(e) => setSideId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2C5282]/30"
            >
              {sides.map((s) => (
                <option key={s.sideId || s.id} value={s.sideId || s.id}>
                  {s.sideCode || s.sideId}
                  {s.shelfId ? '' : ' (no shelf id yet)'}
                </option>
              ))}
            </select>
          </FormField>
        )}

        <FormField label="Planogram name" required hint="Saved as the shelf name on the server.">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dairy Gondola Front"
            maxLength={120}
            disabled={busy}
          />
        </FormField>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Ideal image *</p>
          <p className="text-[11px] text-gray-500 leading-snug">
            Take a photo of this rack face or choose an existing image.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiCamera size={14} />
              Take photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => galleryRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <FiImage size={14} />
              Choose file
            </button>
            {file && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setFile(null)
                  setPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev)
                    return null
                  })
                  if (galleryRef.current) galleryRef.current.value = ''
                  if (cameraRef.current) cameraRef.current.value = ''
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                <FiX size={14} />
                Clear
              </button>
            )}
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Ideal image preview"
              className="mt-1 max-h-48 w-full rounded-xl border border-gray-200 object-contain bg-slate-50"
            />
          ) : (
            <div className="mt-1 flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-slate-50 text-[11px] text-gray-400">
              No image selected
            </div>
          )}
          {file && (
            <p className="text-[11px] text-gray-500 truncate">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>

        <label className="inline-flex items-start gap-2 text-[11px] text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-gray-300"
            checked={saveLayoutFirst}
            disabled={busy || !onSaveLayout}
            onChange={(e) => setSaveLayoutFirst(e.target.checked)}
          />
          <span>
            Save rack layout first so ideal order matches current bins / SKUs
          </span>
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
