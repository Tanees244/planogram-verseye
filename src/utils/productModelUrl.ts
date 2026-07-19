/**
 * Resolve a same-origin URL suitable for useGLTF / GLTFLoader.
 * WebGL cannot load cross-origin storage URLs without CORS — proxy via /api/files/model.
 */

export interface ProductModelFields {
  modelUrl?: string | null
  modelStorageKey?: string | null
}

export function resolveProductModelUrl(fields: ProductModelFields): string | null {
  const rawUrl = typeof fields.modelUrl === 'string' ? fields.modelUrl.trim() : ''
  const key = typeof fields.modelStorageKey === 'string' ? fields.modelStorageKey.trim() : ''

  if (rawUrl) {
    if (rawUrl.startsWith('/')) return rawUrl
    if (/^https?:\/\//i.test(rawUrl)) {
      // Pass the storage key too — the proxy re-presigns via `key` when the
      // (expirable) presigned `url` fails, instead of returning 502.
      const params = new URLSearchParams({ url: rawUrl })
      if (key) params.set('key', key)
      return `/api/files/model?${params.toString()}`
    }
    return rawUrl
  }

  if (key) {
    return `/api/files/model?key=${encodeURIComponent(key)}`
  }

  return null
}

export function isGlbPath(path: string): boolean {
  return /\.glb$/i.test(path) || path.includes('model/gltf')
}
