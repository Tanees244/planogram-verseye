'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlanogramStore, type PendingProductParams } from '@/store/planogramStore'
import { PRODUCT_DRAG_MIME } from '@/components/ProductPalette'

function findBinIdFromIntersects(intersects: THREE.Intersection[]): string | null {
  for (const hit of intersects) {
    let obj: THREE.Object3D | null = hit.object
    while (obj) {
      const id = obj.userData?.id
      if (typeof id === 'string' && id.length > 0) {
        const state = usePlanogramStore.getState()
        for (const rack of state.area.racks) {
          for (const side of rack.sides) {
            for (const row of side.rows) {
              if (row.bins.some((b) => b.id === id)) return id
            }
          }
        }
      }
      obj = obj.parent
    }
  }
  return null
}

function raycastBinAt(
  clientX: number,
  clientY: number,
  el: HTMLCanvasElement,
  raycaster: THREE.Raycaster,
  mouse: THREE.Vector2,
  camera: THREE.Camera,
  scene: THREE.Scene,
): string | null {
  const rect = el.getBoundingClientRect()
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(scene.children, true)
  return findBinIdFromIntersects(hits)
}

/** HTML drag-and-drop from Product Library onto a bin mesh in the 3D scene. */
export function ProductDropHandler() {
  const { camera, gl, scene } = useThree()
  const placeProductOnBin = usePlanogramStore((s) => s.placeProductOnBin)
  const startProductPlacement = usePlanogramStore((s) => s.startProductPlacement)
  const setProductDropHover = usePlanogramStore((s) => s.setProductDropHover)

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let rafId = 0
    let lastClientX = 0
    let lastClientY = 0
    let dragActive = false

    const updateHover = () => {
      rafId = 0
      if (!dragActive) return

      const binId = raycastBinAt(lastClientX, lastClientY, el, raycaster, mouse, camera, scene)
      const state = usePlanogramStore.getState()
      const pending = state.pendingProductParams

      if (!binId || !pending) {
        setProductDropHover(null)
        return
      }

      const fit = state.canProductFitInBin(binId, {
        width: pending.width,
        depth: pending.depth,
        height: pending.height,
        quantity: 1,
      })
      setProductDropHover({
        binId,
        fits: fit.fits,
        reason: fit.reason,
      })
    }

    const scheduleHoverUpdate = (e: DragEvent) => {
      lastClientX = e.clientX
      lastClientY = e.clientY
      if (!rafId) rafId = requestAnimationFrame(updateHover)
    }

    const clearHover = () => {
      dragActive = false
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      setProductDropHover(null)
    }

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(PRODUCT_DRAG_MIME)) return
      dragActive = true
    }

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(PRODUCT_DRAG_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      dragActive = true
      scheduleHoverUpdate(e)
    }

    const onDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(PRODUCT_DRAG_MIME)) return
      const related = e.relatedTarget as Node | null
      if (related && el.contains(related)) return
      clearHover()
    }

    const onDrop = async (e: DragEvent) => {
      const raw = e.dataTransfer?.getData(PRODUCT_DRAG_MIME)
      if (!raw) return
      e.preventDefault()
      e.stopPropagation()
      clearHover()

      let pending: PendingProductParams
      try {
        pending = JSON.parse(raw) as PendingProductParams
      } catch {
        return
      }
      if (!pending?.id) return

      startProductPlacement(pending)

      const binId = raycastBinAt(e.clientX, e.clientY, el, raycaster, mouse, camera, scene)
      if (!binId) {
        usePlanogramStore.setState({
          addProductError: 'Drop the product onto a bin (select/add a bin first).',
        })
        return
      }
      await placeProductOnBin(binId, 1)
    }

    const onDragEnd = () => clearHover()

    el.addEventListener('dragenter', onDragEnter)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    el.addEventListener('dragend', onDragEnd)
    return () => {
      clearHover()
      el.removeEventListener('dragenter', onDragEnter)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
      el.removeEventListener('dragend', onDragEnd)
    }
  }, [camera, gl, scene, placeProductOnBin, startProductPlacement, setProductDropHover])

  return null
}
