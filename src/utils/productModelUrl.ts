/**
 * Resolve a same-origin URL suitable for useGLTF / GLTFLoader.
 * WebGL cannot load cross-origin storage URLs without CORS — proxy via /api/files/model.
 */

export interface ProductModelFields {
  modelUrl?: string | null
  modelStorageKey?: string | null
}

export type SkuAttachmentLike = {
  storageKey?: string | null
  objectKey?: string | null
  url?: string | null
  is3D?: boolean | null
}

/** Strip query/hash and lowercase for extension checks. */
export function attachmentPath(value?: string | null): string {
  if (!value) return ''
  return value.trim().toLowerCase().split('?')[0].split('#')[0]
}

/** Raster / texture files — never feed these to GLTFLoader even if is3D is true. */
export function isRasterImagePath(path?: string | null): boolean {
  const p = attachmentPath(path)
  return /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(p)
}

export function isGlbRef(value?: string | null): boolean {
  const p = attachmentPath(value)
  return p.endsWith('.glb') || p.includes('.glb')
}

/**
 * Classify catalog attachments. Backends sometimes mark PNGs as is3D:true;
 * trust the file extension over the flag.
 */
export function classifySkuAttachment(
  a: SkuAttachmentLike | null | undefined,
): 'model' | 'image' | null {
  if (!a) return null
  const key = a.storageKey || a.objectKey || a.url
  if (!key) return null
  if (isGlbRef(key) || isGlbRef(a.url)) return 'model'
  if (isRasterImagePath(key) || isRasterImagePath(a.url)) return 'image'
  if (a.is3D === true) return 'model'
  return 'image'
}

export function pickModelAttachment(
  attachments: Array<SkuAttachmentLike | null | undefined> | null | undefined,
): SkuAttachmentLike | undefined {
  return (attachments ?? []).find((a) => classifySkuAttachment(a) === 'model') ?? undefined
}

export function pickImageAttachment(
  attachments: Array<SkuAttachmentLike | null | undefined> | null | undefined,
): SkuAttachmentLike | undefined {
  return (attachments ?? []).find((a) => classifySkuAttachment(a) === 'image') ?? undefined
}

/** Recover object key from a MinIO/S3 signed URL path (`/bucket/skus/models/….glb`). */
export function storageKeyFromSignedUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const parts = path.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const key = parts.slice(1).join('/')
    if (!key || key.includes('..')) return null
    return key
  } catch {
    return null
  }
}

/**
 * Stable identity for a file so 500 SKUs that share one GLB (each with a
 * different presigned URL) hit the same cache and the same `/api/files/model` call.
 */
export function canonicalFileCacheKey(src: string): string {
  const t = src.trim()
  if (!t) return t
  try {
    if (t.startsWith('/api/files/')) {
      const u = new URL(t, 'http://local.invalid')
      const key = u.searchParams.get('key')
      if (key) return key
      const nested = u.searchParams.get('url')
      if (nested) return storageKeyFromSignedUrl(nested) ?? nested.split('?')[0]
    }
    if (/^https?:\/\//i.test(t)) {
      return storageKeyFromSignedUrl(t) ?? t.split('?')[0]
    }
  } catch {
    /* ignore */
  }
  if (!t.startsWith('/') && !/^https?:\/\//i.test(t) && !t.includes('..')) return t
  return t.split('?')[0]
}

function storageKeyFromAnyRef(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!t.startsWith('/') && !/^https?:\/\//i.test(t) && !t.includes('..')) return t
  const key = canonicalFileCacheKey(t)
  if (key && !key.startsWith('/') && !/^https?:\/\//i.test(key)) return key
  return storageKeyFromSignedUrl(t)
}

export function resolveProductModelUrl(fields: ProductModelFields): string | null {
  const rawUrl = typeof fields.modelUrl === 'string' ? fields.modelUrl.trim() : ''
  const explicitKey =
    typeof fields.modelStorageKey === 'string' ? fields.modelStorageKey.trim() : ''

  // Never treat raster uploads as GLB (catalog often sets is3D on PNGs).
  if (explicitKey && isRasterImagePath(explicitKey)) {
    /* fall through to rawUrl */
  } else {
    const key = explicitKey || (rawUrl ? storageKeyFromAnyRef(rawUrl) : '') || ''
    if (key && !isRasterImagePath(key)) {
      // Prefer storage key — one proxy URL for every SKU that shares the file.
      return `/api/files/model?key=${encodeURIComponent(key)}`
    }
  }

  if (rawUrl && !isRasterImagePath(rawUrl)) {
    if (rawUrl.startsWith('/')) return rawUrl
    if (/^https?:\/\//i.test(rawUrl)) {
      const fromSigned = storageKeyFromSignedUrl(rawUrl)
      if (fromSigned && isRasterImagePath(fromSigned)) return null
      return `/api/files/model?url=${encodeURIComponent(rawUrl)}`
    }
    return rawUrl
  }

  return null
}

export function isGlbPath(path: string): boolean {
  const p = attachmentPath(path)
  if (isRasterImagePath(p)) return false
  // Proxy URLs carry the real key in ?key= — check that too.
  try {
    if (path.includes('?')) {
      const u = new URL(path, 'http://local.invalid')
      const key = u.searchParams.get('key')
      if (key) return isGlbRef(key)
      const nested = u.searchParams.get('url')
      if (nested) return isGlbRef(nested) || isGlbRef(storageKeyFromSignedUrl(nested))
    }
  } catch {
    /* ignore */
  }
  return /\.glb$/i.test(p) || path.includes('model/gltf') || isGlbRef(p)
}
