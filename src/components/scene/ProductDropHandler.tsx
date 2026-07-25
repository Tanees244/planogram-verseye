'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlanogramStore, type PendingProductParams } from '@/store/planogramStore'
import {
  PRODUCT_DRAG_MIME,
  PRODUCT_MOVE_MIME,
  type ProductMoveDragPayload,
} from '@/components/ProductPalette'
import toast from 'react-hot-toast'

function findBinIdFromIntersects(intersects: THREE.Intersection[]): string | null {
  for (const hit of intersects) {
    let obj: THREE.Object3D | null = hit.object
    while (obj) {
      if (obj.userData?.type === 'product') {
        obj = obj.parent
        continue
      }
      const id = obj.userData?.id
      const isBin = obj.userData?.type === 'bin'
      if (typeof id === 'string' && id.length > 0) {
        const state = usePlanogramStore.getState()
        for (const rack of state.area.racks) {
          for (const side of rack.sides) {
            for (const row of side.rows) {
              if (row.bins.some((b) => b.id === id)) return id
            }
          }
        }
        if (isBin) return null
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

function hasProductDragType(dt: DataTransfer | null): boolean {
  if (!dt) return false
  return dt.types.includes(PRODUCT_DRAG_MIME) || dt.types.includes(PRODUCT_MOVE_MIME)
}

/** HTML drag-and-drop: palette SKU (copy) or existing bin SKU (move) onto a bin mesh. */
export function ProductDropHandler() {
  const { camera, gl, scene } = useThree()
  const placeProductOnBin = usePlanogramStore((s) => s.placeProductOnBin)
  const startProductPlacement = usePlanogramStore((s) => s.startProductPlacement)
  const moveBinInventoryToBin = usePlanogramStore((s) => s.moveBinInventoryToBin)
  const cancelMovingBinInventory = usePlanogramStore((s) => s.cancelMovingBinInventory)
  const setProductDropHover = usePlanogramStore((s) => s.setProductDropHover)

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let rafId = 0
    let lastClientX = 0
    let lastClientY = 0
    let dragActive = false
    let moveSourceBinId: string | null = null

    const dimsForHover = (): { width: number; depth: number; height: number } | null => {
      const state = usePlanogramStore.getState()
      if (moveSourceBinId) {
        for (const rack of state.area.racks) {
          for (const side of rack.sides) {
            for (const row of side.rows) {
              const bin = row.bins.find((b) => b.id === moveSourceBinId)
              const p = bin?.products[0]
              if (p) {
                return {
                  width: Number(p.width) || 0.1,
                  depth: Number(p.depth) || 0.1,
                  height: Number(p.height) || 0.1,
                }
              }
            }
          }
        }
        return null
      }
      const pending = state.pendingProductParams
      if (!pending) return null
      return {
        width: pending.width,
        depth: pending.depth,
        height: pending.height,
      }
    }

    const updateHover = () => {
      rafId = 0
      if (!dragActive) return

      const binId = raycastBinAt(lastClientX, lastClientY, el, raycaster, mouse, camera, scene)
      const dims = dimsForHover()
      if (!binId || !dims) {
        setProductDropHover(null)
        return
      }

      const fit = usePlanogramStore.getState().canProductFitInBin(binId, {
        width: dims.width,
        depth: dims.depth,
        height: dims.height,
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
      moveSourceBinId = null
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      setProductDropHover(null)
    }

    const onDragEnter = (e: DragEvent) => {
      if (!hasProductDragType(e.dataTransfer)) return
      dragActive = true
    }

    const onDragOver = (e: DragEvent) => {
      if (!hasProductDragType(e.dataTransfer)) return
      e.preventDefault()
      const isMove = e.dataTransfer?.types.includes(PRODUCT_MOVE_MIME)
      e.dataTransfer!.dropEffect = isMove ? 'move' : 'copy'
      dragActive = true
      scheduleHoverUpdate(e)
    }

    const onDragLeave = (e: DragEvent) => {
      if (!hasProductDragType(e.dataTransfer)) return
      const related = e.relatedTarget as Node | null
      if (related && el.contains(related)) return
      clearHover()
    }

    const onDrop = async (e: DragEvent) => {
      const moveRaw = e.dataTransfer?.getData(PRODUCT_MOVE_MIME)
      const placeRaw = e.dataTransfer?.getData(PRODUCT_DRAG_MIME)
      if (!moveRaw && !placeRaw) return
      e.preventDefault()
      e.stopPropagation()

      const binId = raycastBinAt(e.clientX, e.clientY, el, raycaster, mouse, camera, scene)
      clearHover()

      if (moveRaw) {
        let payload: ProductMoveDragPayload
        try {
          payload = JSON.parse(moveRaw) as ProductMoveDragPayload
        } catch {
          return
        }
        if (!payload?.sourceBinId) return
        if (!binId) {
          cancelMovingBinInventory()
          toast.error('Drop onto a target bin')
          return
        }
        if (payload.sourceBinId === binId) {
          cancelMovingBinInventory()
          return
        }
        const res = await moveBinInventoryToBin(payload.sourceBinId, binId)
        if (res.success) toast.success(res.message ?? 'Moved SKU')
        else toast.error(res.message ?? 'Move failed')
        return
      }

      let pending: PendingProductParams
      try {
        pending = JSON.parse(placeRaw!) as PendingProductParams
      } catch {
        return
      }
      if (!pending?.id) return

      startProductPlacement(pending)

      if (!binId) {
        usePlanogramStore.setState({
          addProductError: 'Drop the product onto a bin (select/add a bin first).',
        })
        return
      }
      await placeProductOnBin(binId)
    }

    const onDragEnd = () => {
      cancelMovingBinInventory()
      clearHover()
    }

    // Sync move mode when drag starts elsewhere (inventory panel sets MIME + startMoving)
    const onWindowDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(PRODUCT_MOVE_MIME)) return
      if (!moveSourceBinId) {
        // Best-effort: store already has movingInventoryFromBinId from dragstart
        moveSourceBinId = usePlanogramStore.getState().movingInventoryFromBinId
      }
    }

    el.addEventListener('dragenter', onDragEnter)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    el.addEventListener('dragend', onDragEnd)
    window.addEventListener('dragover', onWindowDragOver)
    return () => {
      clearHover()
      el.removeEventListener('dragenter', onDragEnter)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
      el.removeEventListener('dragend', onDragEnd)
      window.removeEventListener('dragover', onWindowDragOver)
    }
  }, [
    camera,
    gl,
    scene,
    placeProductOnBin,
    startProductPlacement,
    moveBinInventoryToBin,
    cancelMovingBinInventory,
    setProductDropHover,
  ])

  return null
}
