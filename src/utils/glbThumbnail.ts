'use client'

/**
 * Renders a GLB into a small PNG data-URL using ONE shared offscreen
 * WebGL renderer. Lists can then show 3D previews as plain <img> tags
 * without hitting the browser's WebGL-context limit.
 *
 * Bytes + PNG are cached by storage key so 500 SKUs that share one model
 * trigger a single /api/files/model request.
 */

import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { canonicalFileCacheKey, resolveProductModelUrl } from '@/utils/productModelUrl'

const THUMB_SIZE = 160

const thumbCache = new Map<string, Promise<string | null>>()
const glbBytesCache = new Map<string, Promise<ArrayBuffer>>()

let renderer: WebGLRenderer | null = null
let loader: GLTFLoader | null = null

function getRenderer(): WebGLRenderer {
  if (!renderer) {
    renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(1)
    renderer.setSize(THUMB_SIZE, THUMB_SIZE)
    renderer.outputColorSpace = SRGBColorSpace
  }
  return renderer
}

function getLoader(): GLTFLoader {
  if (!loader) loader = new GLTFLoader()
  return loader
}

function proxyUrlFor(src: string): string {
  const key = canonicalFileCacheKey(src)
  if (key && !key.startsWith('/') && !/^https?:\/\//i.test(key)) {
    return `/api/files/model?key=${encodeURIComponent(key)}`
  }
  return resolveProductModelUrl({ modelUrl: src }) ?? src
}

async function fetchGlbBytes(url: string): Promise<Response> {
  let res = await fetch(url, { credentials: 'include', cache: 'force-cache' })
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After'))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800
    await new Promise((r) => setTimeout(r, waitMs))
    res = await fetch(url, { credentials: 'include', cache: 'reload' })
  }
  return res
}

/** One network fetch per unique GLB (shared by list thumbs and later 3D). */
export function fetchSharedGlbBytes(src: string): Promise<ArrayBuffer> {
  const key = canonicalFileCacheKey(src)
  let pending = glbBytesCache.get(key)
  if (!pending) {
    pending = fetchGlbBytes(proxyUrlFor(src)).then(async (res) => {
      if (!res.ok) throw new Error(`glb ${res.status}`)
      return res.arrayBuffer()
    })
    glbBytesCache.set(key, pending)
    pending.catch(() => {
      glbBytesCache.delete(key)
    })
  }
  return pending
}

async function renderThumbnail(src: string): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const bytes = await fetchSharedGlbBytes(src)
    const gltf = await getLoader().parseAsync(bytes, '')
    const model = gltf.scene

    const scene = new Scene()
    scene.background = null
    scene.add(new AmbientLight(new Color('#ffffff'), 0.9))
    const key = new DirectionalLight(new Color('#ffffff'), 1.1)
    key.position.set(2, 3, 2)
    scene.add(key)
    const fill = new DirectionalLight(new Color('#ffffff'), 0.35)
    fill.position.set(-2, 1, -1)
    scene.add(fill)
    scene.add(model)

    const box = new Box3().setFromObject(model)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const radius = Math.max(size.x, size.y, size.z, 0.001) * 0.5

    const camera = new PerspectiveCamera(38, 1, radius / 100, radius * 100)
    const dist = (radius / Math.tan((camera.fov * Math.PI) / 360)) * 1.35
    camera.position.set(
      center.x + dist * 0.55,
      center.y + dist * 0.4,
      center.z + dist * 0.75,
    )
    camera.lookAt(center)

    const r = getRenderer()
    r.render(scene, camera)
    const dataUrl = r.domElement.toDataURL('image/png')

    model.traverse((child: any) => {
      child.geometry?.dispose?.()
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const m of mats) {
        if (!m) continue
        for (const v of Object.values(m)) (v as any)?.isTexture && (v as any).dispose()
        m.dispose?.()
      }
    })

    return dataUrl
  } catch {
    return null
  }
}

/** Cached GLB → PNG data-URL. Same model file is fetched and rendered once. */
export function getGlbThumbnail(url: string): Promise<string | null> {
  const key = canonicalFileCacheKey(url)
  let pending = thumbCache.get(key)
  if (!pending) {
    pending = renderThumbnail(url)
    thumbCache.set(key, pending)
  }
  return pending
}

/** Warm unique models from a SKU list (no-op for duplicates). */
export function preloadGlbThumbnails(urls: Array<string | null | undefined>) {
  const seen = new Set<string>()
  for (const url of urls) {
    if (!url) continue
    const key = canonicalFileCacheKey(url)
    if (seen.has(key)) continue
    seen.add(key)
    void getGlbThumbnail(url)
  }
}
