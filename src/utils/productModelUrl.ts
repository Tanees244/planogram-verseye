/**
 * Resolve a same-origin URL suitable for useGLTF / GLTFLoader.
 * WebGL cannot load cross-origin storage URLs without CORS — proxy via /api/files/model.
 */

export interface ProductModelFields {
  modelUrl?: string | null
  modelStorageKey?: string | null
}

/** Recover object key from a MinIO/S3 signed URL path (`/bucket/skus/models/….glb`). */
function storageKeyFromSignedUrl(url: string): string | null {
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

export function resolveProductModelUrl(fields: ProductModelFields): string | null {
  const rawUrl = typeof fields.modelUrl === 'string' ? fields.modelUrl.trim() : ''
  const explicitKey =
    typeof fields.modelStorageKey === 'string' ? fields.modelStorageKey.trim() : ''
  const inferredKey =
    !explicitKey && rawUrl && /^https?:\/\//i.test(rawUrl)
      ? storageKeyFromSignedUrl(rawUrl)
      : null
  const key = explicitKey || inferredKey || ''

  // Prefer storage key — short URL, fresh server-side presign, no expiry / encoding issues.
  if (key) {
    return `/api/files/model?key=${encodeURIComponent(key)}`
  }

  if (rawUrl) {
    if (rawUrl.startsWith('/')) return rawUrl
    if (/^https?:\/\//i.test(rawUrl)) {
      return `/api/files/model?url=${encodeURIComponent(rawUrl)}`
    }
    return rawUrl
  }

  return null
}

export function isGlbPath(path: string): boolean {
  return /\.glb$/i.test(path) || path.includes('model/gltf')
}
