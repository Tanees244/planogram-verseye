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
  if (rawUrl) {
    if (rawUrl.startsWith('/')) return rawUrl
    if (/^https?:\/\//i.test(rawUrl)) {
      return `/api/files/model?url=${encodeURIComponent(rawUrl)}`
    }
    return rawUrl
  }

  const key = typeof fields.modelStorageKey === 'string' ? fields.modelStorageKey.trim() : ''
  if (key) {
    return `/api/files/model?key=${encodeURIComponent(key)}`
  }

  return null
}

export function isGlbPath(path: string): boolean {
  return /\.glb$/i.test(path) || path.includes('model/gltf')
}
