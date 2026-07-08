import { getPlanogramTokenFromCookie } from '@verseye/utils'

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

/** Extract storage key from various upload / presign response shapes. */
export function extractStorageKey(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const candidates = [
    d.objectKey,
    d.storageKey,
    d.imageStorageKey,
    d.key,
    d.path,
    (d.file as Record<string, unknown> | undefined)?.objectKey,
    (d.file as Record<string, unknown> | undefined)?.storageKey,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

/**
 * Upload a file to object storage via the backend multipart endpoint.
 * Returns `{ storageKey, imageUrl? }` on success.
 */
export async function uploadCatalogImage(
  file: File,
  folder = 'skus',
): Promise<{ success: boolean; storageKey?: string; imageUrl?: string; message?: string }> {
  const form = new FormData()
  form.append('file', file)

  try {
    const res = await fetch(`/api/files/upload?folder=${encodeURIComponent(folder)}`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: json?.message || 'Upload failed' }
    }
    const data = json?.data ?? json
    const storageKey = extractStorageKey(data)
    if (!storageKey) {
      return {
        success: false,
        message: 'Upload succeeded but no storage key was returned',
      }
    }
    const imageUrl =
      (typeof data?.url === 'string' && data.url) ||
      (typeof data?.imageUrl === 'string' && data.imageUrl) ||
      (typeof data?.presignedUrl === 'string' && data.presignedUrl) ||
      undefined
    return { success: true, storageKey, imageUrl }
  } catch {
    return { success: false, message: 'Network error while uploading image' }
  }
}
