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
import { findRowPlacementContext, binDimsForPack, inferPlacementAnchor } from '@/utils/productRowPlacement'
import { resolveIsStackable } from '@/utils/stackableSku'
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

function findRowIdFromIntersects(intersects: THREE.Intersection[]): string | null {
  for (const hit of intersects) {
    let obj: THREE.Object3D | null = hit.object
    while (obj) {
      const id = obj.userData?.id
      const type = obj.userData?.type
      if (typeof id === 'string' && id.length > 0) {
        if (type === 'row') return id
        // Bin → parent row
        const state = usePlanogramStore.getState()
        for (const rack of state.area.racks) {
          for (const side of rack.sides) {
            for (const row of side.rows) {
              if (row.id === id) return id
              if (row.bins.some((b) => b.id === id)) return row.id
            }
          }
        }
      }
      obj = obj.parent
    }
  }
  return null
}

function inferAnchorFromHits(intersects: THREE.Intersection[], rowId: string): 'left' | 'right' {
  const ctx = findRowPlacementContext(usePlanogramStore.getState().area.racks, rowId)
  if (!ctx) return 'left'
  for (const hit of intersects) {
    let obj: THREE.Object3D | null = hit.object
    while (obj) {
      if (obj.userData?.type === 'row' && obj.userData?.id === rowId) {
        const local = obj.worldToLocal(hit.point.clone())
        return inferPlacementAnchor(local.x, ctx.rowSpan, ctx.row.bins)
      }
      obj = obj.parent
    }
  }
  return 'left'
}

function raycastAt(
  clientX: number,
  clientY: number,
  el: HTMLCanvasElement,
  raycaster: THREE.Raycaster,
  mouse: THREE.Vector2,
  camera: THREE.Camera,
  scene: THREE.Scene,
): THREE.Intersection[] {
  const rect = el.getBoundingClientRect()
  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  return raycaster.intersectObjects(scene.children, true)
}

function hasProductDragType(dt: DataTransfer | null): boolean {
  if (!dt) return false
  return dt.types.includes(PRODUCT_DRAG_MIME) || dt.types.includes(PRODUCT_MOVE_MIME)
}

function rowAllowedWhilePlacing(rowId: string): boolean {
  const state = usePlanogramStore.getState()
  if (state.selectedType !== 'rack' || !state.selectedId) return true
  return state.area.racks.some(
    (r) =>
      r.id === state.selectedId &&
      r.sides.some((s) => s.rows.some((row) => row.id === rowId)),
  )
}

/** HTML drag-and-drop: palette SKU onto a shelf/row, or move between bins. */
export function ProductDropHandler() {
  const { camera, gl, scene } = useThree()
  const setProductPlacementTarget = usePlanogramStore((s) => s.setProductPlacementTarget)
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

    const dimsForHover = (): { width: number; depth: number; height: number; isStackable?: boolean; id?: string } | null => {
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
                  isStackable: p.isStackable,
                  id: p.id,
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
        isStackable: pending.isStackable,
        id: pending.id,
      }
    }

    const updateHover = () => {
      rafId = 0
      if (!dragActive) return

      const hits = raycastAt(lastClientX, lastClientY, el, raycaster, mouse, camera, scene)

      if (moveSourceBinId) {
        const binId = findBinIdFromIntersects(hits)
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
        return
      }

      const rowId = findRowIdFromIntersects(hits)
      const dims = dimsForHover()
      if (!rowId || !dims || !rowAllowedWhilePlacing(rowId)) {
        setProductDropHover(null)
        return
      }

      const state = usePlanogramStore.getState()
      const ctx = findRowPlacementContext(state.area.racks, rowId)
      if (!ctx) {
        setProductDropHover({ rowId, fits: false, reason: 'Shelf not found' })
        return
      }
      const stackable = resolveIsStackable(dims.id, { isStackable: dims.isStackable })
      const facings = Math.max(1, Math.floor(ctx.remainingWidth / dims.width + 1e-6))
      const depthRows = Math.max(1, Math.floor(ctx.availableDepth / dims.depth + 1e-6))
      const stack = Math.max(
        1,
        stackable ? Math.floor(ctx.rowHeight / dims.height + 1e-6) : 1,
      )
      const pending = state.pendingProductParams
      if (!pending) {
        setProductDropHover(null)
        return
      }
      const sized = binDimsForPack(
        pending,
        facings,
        depthRows,
        stack,
        ctx.remainingWidth,
        ctx.availableDepth,
        ctx.rowHeight,
      )
      setProductDropHover({
        rowId,
        fits: sized.fits,
        reason: sized.reason,
        anchor: inferAnchorFromHits(hits, rowId),
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
      if (isMove) {
        moveSourceBinId = usePlanogramStore.getState().movingInventoryFromBinId
      }
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

      const hits = raycastAt(e.clientX, e.clientY, el, raycaster, mouse, camera, scene)
      clearHover()

      if (moveRaw) {
        let payload: ProductMoveDragPayload
        try {
          payload = JSON.parse(moveRaw) as ProductMoveDragPayload
        } catch {
          return
        }
        if (!payload?.sourceBinId) return
        const binId = findBinIdFromIntersects(hits)
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

      const rowId = findRowIdFromIntersects(hits)
      if (!rowId || !rowAllowedWhilePlacing(rowId)) {
        usePlanogramStore.setState({
          addProductError: 'Drop the product onto a shelf (row).',
        })
        return
      }
      const res = setProductPlacementTarget(rowId, {
        anchor: inferAnchorFromHits(hits, rowId),
      })
      if (!res.success && res.message) {
        toast.error(res.message)
      }
    }

    const onDragEnd = () => {
      cancelMovingBinInventory()
      clearHover()
    }

    const onWindowDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(PRODUCT_MOVE_MIME)) return
      if (!moveSourceBinId) {
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
    setProductPlacementTarget,
    startProductPlacement,
    moveBinInventoryToBin,
    cancelMovingBinInventory,
    setProductDropHover,
  ])

  return null
}
