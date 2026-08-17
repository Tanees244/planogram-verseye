import { SRGBColorSpace, Texture, TextureLoader } from 'three'
import { canonicalFileCacheKey, storageKeyFromSignedUrl } from '@/utils/productModelUrl'
import { getPlanogramTokenFromCookie } from '@verseye/utils'

type CacheEntry = {
  status: 'loading' | 'ready' | 'error'
  texture: Texture | null
  objectUrl: string | null
  waiters: Set<(texture: Texture | null) => void>
  refs: number
}

const cache = new Map<string, CacheEntry>()

function imageAuthHeaders(): HeadersInit {
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) return { Authorization: `Bearer ${t}` }
  } catch {
    /* ignore */
  }
  return {}
}

/** Same-origin proxy URL used by Product / SkuThumb. */
export function productImageProxyUrl(
  imageUrl?: string | null,
  imageStorageKey?: string | null,
): string | null {
  const explicit = imageStorageKey?.trim()
  if (explicit && !explicit.toLowerCase().split('?')[0].endsWith('.glb')) {
    return `/api/files/image?key=${encodeURIComponent(explicit)}`
  }
  const url = imageUrl?.trim()
  if (!url) return null
  const fromSigned = storageKeyFromSignedUrl(url)
  if (fromSigned && !fromSigned.toLowerCase().endsWith('.glb')) {
    return `/api/files/image?key=${encodeURIComponent(fromSigned)}`
  }
  if (url.startsWith('/')) return url
  return `/api/files/image?url=${encodeURIComponent(url)}`
}

/**
 * Load a product image once and share the Three texture across all facings.
 * Prevents N parallel TextureLoader calls for the same SKU (which stalls
 * "all pictures loading" on dense depth×stack packs).
 */
function imageFetchUrl(proxyUrl: string, cacheKey: string): string {
  if (proxyUrl.startsWith('/api/files/image?key=')) return proxyUrl
  if (cacheKey && !cacheKey.startsWith('/') && !/^https?:\/\//i.test(cacheKey)) {
    return `/api/files/image?key=${encodeURIComponent(cacheKey)}`
  }
  return proxyUrl
}

export function acquireProductTexture(
  proxyUrl: string,
  onReady: (texture: Texture | null) => void,
): () => void {
  const cacheKey = canonicalFileCacheKey(proxyUrl) || proxyUrl
  let entry = cache.get(cacheKey)
  if (!entry) {
    entry = {
      status: 'loading',
      texture: null,
      objectUrl: null,
      waiters: new Set(),
      refs: 0,
    }
    cache.set(cacheKey, entry)
    void loadEntry(imageFetchUrl(proxyUrl, cacheKey), cacheKey, entry)
  }

  entry.refs += 1

  if (entry.status === 'ready' || entry.status === 'error') {
    onReady(entry.texture)
  } else {
    entry.waiters.add(onReady)
  }

  return () => {
    entry.waiters.delete(onReady)
    entry.refs = Math.max(0, entry.refs - 1)
    if (entry.refs === 0 && entry.status !== 'loading') {
      if (entry.status === 'error') {
        disposeEntry(cacheKey, entry)
      }
    }
  }
}

async function loadEntry(fetchUrl: string, cacheKey: string, entry: CacheEntry) {
  try {
    const res = await fetch(fetchUrl, {
      credentials: 'include',
      headers: imageAuthHeaders(),
      cache: 'force-cache',
    })
    if (!res.ok) throw new Error(`image ${res.status}`)
    const blob = await res.blob()
    if (entry.refs === 0 && entry.waiters.size === 0) {
      cache.delete(cacheKey)
      return
    }

    const objectUrl = URL.createObjectURL(blob)
    entry.objectUrl = objectUrl
    const loader = new TextureLoader()
    loader.load(
      objectUrl,
      (tex) => {
        if (entry.refs === 0 && entry.waiters.size === 0) {
          tex.dispose()
          URL.revokeObjectURL(objectUrl)
          cache.delete(cacheKey)
          return
        }
        tex.colorSpace = SRGBColorSpace
        tex.anisotropy = 4
        tex.needsUpdate = true
        ;(tex as Texture & { dispose: () => void }).dispose = () => {
          /* kept alive by productTextureCache */
        }
        entry.texture = tex
        entry.status = 'ready'
        notify(entry, tex)
      },
      undefined,
      () => {
        entry.status = 'error'
        entry.texture = null
        if (entry.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl)
          entry.objectUrl = null
        }
        notify(entry, null)
      },
    )
  } catch {
    entry.status = 'error'
    entry.texture = null
    notify(entry, null)
  }
}

function notify(entry: CacheEntry, texture: Texture | null) {
  const waiters = [...entry.waiters]
  entry.waiters.clear()
  for (const w of waiters) w(texture)
}

function disposeEntry(proxyUrl: string, entry: CacheEntry) {
  const tex = entry.texture
  if (tex) {
    // Restore real dispose (we no-op instance.dispose while cached/shared).
    Texture.prototype.dispose.call(tex)
  }
  if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl)
  cache.delete(proxyUrl)
}
