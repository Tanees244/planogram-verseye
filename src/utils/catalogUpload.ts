import { getPlanogramTokenFromCookie } from '@verseye/utils'

export type UploadPurpose = 'GenericFile' | 'ShelfCapture' | 'PlanogramImage'

function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (json) headers['Content-Type'] = 'application/json'
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
  const nested =
    d.data && typeof d.data === 'object' ? (d.data as Record<string, unknown>) : null
  const candidates = [
    d.objectKey,
    d.storageKey,
    d.imageStorageKey,
    d.modelStorageKey,
    d.key,
    d.path,
    nested?.objectKey,
    nested?.storageKey,
    (d.file as Record<string, unknown> | undefined)?.objectKey,
    (d.file as Record<string, unknown> | undefined)?.storageKey,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

export interface SkuAttachmentItem {
  storageKey: string
  is3D: boolean
}

/** Build catalog SKU `attachments` payload (replaces legacy `attachmentStorageKeys`). */
export function buildSkuAttachments(
  imageStorageKey?: string | null,
  modelStorageKey?: string | null,
): SkuAttachmentItem[] {
  const attachments: SkuAttachmentItem[] = []
  if (imageStorageKey?.trim()) {
    attachments.push({ storageKey: imageStorageKey.trim(), is3D: false })
  }
  if (modelStorageKey?.trim()) {
    attachments.push({ storageKey: modelStorageKey.trim(), is3D: true })
  }
  return attachments
}

function unwrapData(json: Record<string, unknown>): Record<string, unknown> {
  const inner = json.data
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>
  }
  return json
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function completeWithRetry(
  objectKey: string,
  attempts = 5,
): Promise<{ success: boolean; storageKey?: string; message?: string }> {
  let lastMessage = 'Upload verification failed'
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch('/api/files/complete', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ objectKey }),
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      const data = unwrapData(json)
      const status = String(data.status ?? data.Status ?? '')
      const nextKey = extractStorageKey(data) ?? objectKey
      if (res.ok && json.isRequestSuccess !== false && status.toLowerCase() === 'verified') {
        return { success: true, storageKey: nextKey }
      }
      const rejection =
        (typeof data.rejectionReason === 'string' && data.rejectionReason) ||
        (typeof json.message === 'string' && json.message) ||
        null
      lastMessage = rejection || `Upload not verified (${status || res.status})`
      // Pending / not yet visible — retry. Rejected / forbidden — stop.
      if (res.status === 403 || status.toLowerCase() === 'rejected') {
        return { success: false, message: lastMessage }
      }
    } catch {
      lastMessage = 'Network error while verifying upload'
    }
    await delay(300 * (i + 1))
  }
  return { success: false, message: lastMessage }
}

function purposeForFolder(folder: string, purpose?: UploadPurpose): UploadPurpose {
  if (purpose) return purpose
  if (/planogram|shelf/i.test(folder)) return 'PlanogramImage'
  return 'GenericFile'
}

/**
 * Upload via presign → PUT → complete (required). Multipart /files/upload is disabled.
 */
export async function uploadCatalogFile(
  file: File,
  folder = 'skus',
  purpose?: UploadPurpose,
): Promise<{ success: boolean; storageKey?: string; imageUrl?: string; message?: string }> {
  const maxImage = 20 * 1024 * 1024
  if (file.type.startsWith('image/') && file.size > maxImage) {
    return { success: false, message: 'Image must be 20 MB or smaller' }
  }

  try {
    const presignRes = await fetch('/api/files/presigned-upload', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        purpose: purposeForFolder(folder, purpose),
      }),
    })
    const presignJson = (await presignRes.json().catch(() => ({}))) as Record<string, unknown>
    if (!presignRes.ok || presignJson.isRequestSuccess === false) {
      return {
        success: false,
        message:
          (typeof presignJson.message === 'string' && presignJson.message) ||
          'Failed to start upload',
      }
    }

    const data = unwrapData(presignJson)
    const objectKey = extractStorageKey(data)
    const url = typeof data.url === 'string' ? data.url : null
    const method = typeof data.method === 'string' ? data.method : 'PUT'
    const putHeadersRaw =
      data.headers && typeof data.headers === 'object'
        ? (data.headers as Record<string, string>)
        : {}
    if (!objectKey || !url) {
      return { success: false, message: 'Presign did not return url and objectKey' }
    }

    const putHeaders = new Headers()
    for (const [k, v] of Object.entries(putHeadersRaw)) {
      if (typeof v === 'string' && v) putHeaders.set(k, v)
    }
    if (!putHeaders.has('Content-Type')) {
      putHeaders.set('Content-Type', file.type || 'application/octet-stream')
    }

    const put = await fetch(url, {
      method,
      headers: putHeaders,
      body: file,
    })
    if (!put.ok) {
      return { success: false, message: `Storage upload failed (${put.status})` }
    }

    const completed = await completeWithRetry(objectKey)
    if (!completed.success || !completed.storageKey) {
      return { success: false, message: completed.message || 'Upload was not verified' }
    }
    return { success: true, storageKey: completed.storageKey }
  } catch {
    return { success: false, message: 'Network error while uploading file' }
  }
}

/** @deprecated use uploadCatalogFile */
export async function uploadCatalogImage(
  file: File,
  folder = 'skus',
): Promise<{ success: boolean; storageKey?: string; imageUrl?: string; message?: string }> {
  return uploadCatalogFile(file, folder)
}
