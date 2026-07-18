'use client'

/**
 * Renders a GLB into a small PNG data-URL using ONE shared offscreen
 * WebGL renderer. Lists can then show 3D previews as plain <img> tags
 * without hitting the browser's WebGL-context limit.
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

const THUMB_SIZE = 160

const cache = new Map<string, Promise<string | null>>()

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

async function renderThumbnail(url: string): Promise<string | null> {
  if (typeof window === 'undefined') return null
  try {
    const gltf = await getLoader().loadAsync(url)
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

    // Frame the model with a slight top-down 3/4 angle
    const box = new Box3().setFromObject(model)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const radius = Math.max(size.x, size.y, size.z, 0.001) * 0.5

    const camera = new PerspectiveCamera(38, 1, radius / 100, radius * 100)
    const dist = radius / Math.tan((camera.fov * Math.PI) / 360) * 1.35
    camera.position.set(
      center.x + dist * 0.55,
      center.y + dist * 0.4,
      center.z + dist * 0.75,
    )
    camera.lookAt(center)

    const r = getRenderer()
    r.render(scene, camera)
    const dataUrl = r.domElement.toDataURL('image/png')

    // Free GPU resources held by this model
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

/** Cached GLB → PNG data-URL. Returns null when the model can't be loaded. */
export function getGlbThumbnail(url: string): Promise<string | null> {
  let pending = cache.get(url)
  if (!pending) {
    pending = renderThumbnail(url)
    cache.set(url, pending)
  }
  return pending
}
