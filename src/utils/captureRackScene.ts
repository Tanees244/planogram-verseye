import * as THREE from 'three'
import { usePlanogramStore } from '@/store/planogramStore'

type CaptureOpts = { rackId?: string | null }

type CaptureFn = (opts?: CaptureOpts) => string | null

let captureFn: CaptureFn | null = null

export function registerSceneCapture(fn: CaptureFn | null) {
  captureFn = fn
}

export function resolveCaptureRackId(): string | null {
  const s = usePlanogramStore.getState()
  if (s.selectedType === 'rack' && s.selectedId) return s.selectedId
  if (!s.selectedId) return s.area.racks[0]?.id ?? null
  for (const rack of s.area.racks) {
    if (rack.id === s.selectedId || rack.rackId === s.selectedId) return rack.id
    for (const side of rack.sides) {
      if (side.id === s.selectedId || side.sideId === s.selectedId) return rack.id
      for (const row of side.rows) {
        if (row.id === s.selectedId) return rack.id
        for (const bin of row.bins) {
          if (bin.id === s.selectedId) return rack.id
          if (
            bin.products.some(
              (p) =>
                p.id === s.selectedId ||
                String(p.id).replace(/::facing-\d+$/, '') === s.selectedId,
            )
          ) {
            return rack.id
          }
        }
      }
    }
  }
  return s.area.racks[0]?.id ?? null
}

/** 3D PNG of the rack only (warehouse / floor / sky cropped out). */
export function captureRackOnlyPng(rackId?: string | null): string | null {
  return captureFn?.({ rackId: rackId ?? resolveCaptureRackId() }) ?? null
}

export function captureRackFromRenderer(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts?: CaptureOpts,
): string | null {
  const rackId = opts?.rackId ?? null
  const targets: THREE.Object3D[] = []
  scene.traverse((obj) => {
    if (obj.userData?.type !== 'rack') return
    if (!rackId || obj.userData.id === rackId || obj.userData.rackId === rackId) {
      targets.push(obj)
    }
  })
  if (!targets.length) {
    scene.traverse((obj) => {
      if (obj.userData?.type === 'rack') targets.push(obj)
    })
  }
  if (!targets.length) return null

  const box = new THREE.Box3()
  for (const t of targets) box.expandByObject(t)

  const keep = new Set<THREE.Object3D>()
  const mark = (obj: THREE.Object3D) => {
    keep.add(obj)
    obj.traverse((c) => keep.add(c))
    let p: THREE.Object3D | null = obj.parent
    while (p) {
      keep.add(p)
      p = p.parent
    }
  }
  targets.forEach(mark)
  scene.traverse((obj) => {
    if ((obj as THREE.Light).isLight || (obj as THREE.Camera).isCamera) mark(obj)
  })

  const hidden: Array<{ obj: THREE.Object3D; visible: boolean }> = []
  scene.traverse((obj) => {
    if (obj === scene) return
    if (!keep.has(obj) && obj.visible) {
      hidden.push({ obj, visible: true })
      obj.visible = false
    }
  })

  const prevBg = scene.background
  const prevFog = scene.fog
  const prevClear = new THREE.Color()
  gl.getClearColor(prevClear)
  const prevAlpha = gl.getClearAlpha()
  scene.background = new THREE.Color('#f4f6f8')
  scene.fog = null
  gl.setClearColor('#f4f6f8', 1)

  try {
    gl.render(scene, camera)
    const canvas = gl.domElement
    if (box.isEmpty()) return canvas.toDataURL('image/png')

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ]
    const ndc = new THREE.Vector3()
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let any = false
    for (const c of corners) {
      ndc.copy(c).project(camera)
      if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) continue
      if (Math.abs(ndc.z) > 1.5) continue
      const x = (ndc.x * 0.5 + 0.5) * canvas.width
      const y = (-ndc.y * 0.5 + 0.5) * canvas.height
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      any = true
    }
    if (!any || maxX <= minX || maxY <= minY) return canvas.toDataURL('image/png')

    const pad = Math.max(16, Math.round(Math.max(maxX - minX, maxY - minY) * 0.06))
    const sx = Math.max(0, Math.floor(minX - pad))
    const sy = Math.max(0, Math.floor(minY - pad))
    const sw = Math.min(canvas.width - sx, Math.ceil(maxX + pad) - sx)
    const sh = Math.min(canvas.height - sy, Math.ceil(maxY + pad) - sy)
    if (sw < 8 || sh < 8) return canvas.toDataURL('image/png')

    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    const ctx = out.getContext('2d')
    if (!ctx) return canvas.toDataURL('image/png')
    ctx.fillStyle = '#f4f6f8'
    ctx.fillRect(0, 0, sw, sh)
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
    return out.toDataURL('image/png')
  } finally {
    hidden.forEach(({ obj, visible }) => {
      obj.visible = visible
    })
    scene.background = prevBg
    scene.fog = prevFog
    gl.setClearColor(prevClear, prevAlpha)
    gl.render(scene, camera)
  }
}
