'use client'

import { useEffect, useState } from 'react'
import { FiImage, FiPlus } from 'react-icons/fi'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { uploadCatalogFile } from '@/utils/catalogUpload'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'
import type { PosmItemListItem } from '@/types/rackBlueprint'
import { getUserEnteredNames, rememberUserEnteredName } from '@/utils/userEnteredNames'

const POSM_TYPES = ['ShelfTalker', 'Standee', 'Flyer'] as const

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

export function CreatePosmForm({
  storeId,
  dark = true,
  onCreated,
}: {
  storeId: string | null
  dark?: boolean
  onCreated: (item: PosmItemListItem) => void
}) {
  const [open, setOpen] = useState(true)
  const [name, setName] = useState('')
  const [posmType, setPosmType] = useState<string>('ShelfTalker')
  const [conditionStandards, setConditionStandards] = useState('Standard')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (open) setNameSuggestions(getUserEnteredNames('posm'))
  }, [open])

  const reset = () => {
    setName('')
    setPosmType('ShelfTalker')
    setConditionStandards('Standard')
    setImageFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setError(null)
  }

  const handleCreate = async () => {
    if (!storeId) {
      setError('Select a store first')
      return
    }
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!imageFile) {
      setError('Upload an image for the shelf talker')
      return
    }

    setBusy(true)
    setError(null)
    try {
      let imageStorageKey: string | null = null
      let imageUrl: string | null = null
      if (imageFile) {
        const up = await uploadCatalogFile(imageFile, 'posm')
        if (!up.success || !up.storageKey) {
          setError(up.message ?? 'Image upload failed')
          return
        }
        imageStorageKey = up.storageKey
        imageUrl = up.imageUrl ?? null
      }

      const res = await fetch('/api/company-assets/posm', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          posmType,
          status: 'Active',
          storeIds: [storeId],
          conditionStandards: conditionStandards.trim() || 'Standard',
          imageStorageKey,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.isRequestSuccess === false) {
        setError(json?.message || 'Failed to create POSM item')
        return
      }

      const data = json?.data
      const createdId =
        typeof data === 'string'
          ? data.trim()
          : data && typeof data === 'object'
            ? String(
                (data as Record<string, unknown>).id ??
                  (data as Record<string, unknown>).posmItemId ??
                  '',
              ).trim()
            : ''

      const created: PosmItemListItem = {
        id: createdId,
        name: name.trim(),
        posmType,
        status: 'Active',
        conditionStandards: conditionStandards.trim() || 'Standard',
        imageStorageKey,
        imageUrl,
      }
      if (!created.id) {
        setError('POSM created but no id returned')
        return
      }

      rememberUserEnteredName('posm', name.trim())
      onCreated(created)
      reset()
      setOpen(false)
    } catch {
      setError('Could not create POSM item')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={!storeId}
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors',
          dark
            ? 'border-brand/40 text-brand-light hover:bg-brand/15'
            : 'border-brand/30 text-brand hover:bg-brand/5',
          !storeId && 'opacity-45 cursor-not-allowed',
        )}
      >
        <FiPlus size={12} />
        Create POSM + image
      </button>
    )
  }

  const field = dark
    ? 'w-full px-2 py-1.5 text-xs rounded-lg bg-white/10 border border-white/15 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand'
    : 'w-full px-2 py-1.5 text-xs rounded-lg bg-white border border-gray-200 text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand'

  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 space-y-2',
        dark ? 'border-brand/35 bg-brand/10' : 'border-brand/25 bg-brand/5',
      )}
    >
      <p className={cn('text-[10px] font-semibold uppercase tracking-wide', dark ? 'text-brand-light' : 'text-brand')}>
        New POSM item
      </p>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <label className="block">
        <span className={cn('text-[10px]', dark ? 'text-gray-400' : 'text-gray-500')}>Name *</span>
        <input
          className={cn(field, 'mt-0.5')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer Promo Header"
          maxLength={80}
          list="posm-name-suggestions"
        />
        <datalist id="posm-name-suggestions">
          {nameSuggestions.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={cn('text-[10px]', dark ? 'text-gray-400' : 'text-gray-500')}>Type *</span>
          <select className={cn(field, 'mt-0.5')} value={posmType} onChange={(e) => setPosmType(e.target.value)}>
            {POSM_TYPES.map((t) => (
              <option key={t} value={t} className="bg-gray-900 text-white">
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={cn('text-[10px]', dark ? 'text-gray-400' : 'text-gray-500')}>Standards</span>
          <input
            className={cn(field, 'mt-0.5')}
            value={conditionStandards}
            onChange={(e) => setConditionStandards(e.target.value)}
            placeholder="Standard"
          />
        </label>
      </div>

      <label
        className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-2 py-3 cursor-pointer transition-colors',
          dark ? 'border-white/20 hover:bg-white/5' : 'border-gray-300 hover:bg-gray-50',
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="POSM preview" className="h-16 w-auto rounded object-contain" />
        ) : (
          <>
            <FiImage size={16} className={dark ? 'text-gray-400' : 'text-gray-500'} />
            <span className={cn('text-[10px]', dark ? 'text-gray-400' : 'text-gray-500')}>
              Upload shelf talker image *
            </span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            setImageFile(file)
            if (preview) URL.revokeObjectURL(preview)
            setPreview(file ? URL.createObjectURL(file) : null)
          }}
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            reset()
            setOpen(false)
          }}
          className={cn(
            'flex-1 px-2 py-1.5 rounded-lg text-[11px]',
            dark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100',
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !storeId}
          onClick={() => void handleCreate()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-brand text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy && <Spinner />}
          {busy ? 'Creating…' : 'Create & assign'}
        </button>
      </div>
    </div>
  )
}
