'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlanogramStore } from '@/store/planogramStore'
import type { RackSurfacePosm } from '@/types/rackBlueprint'

export const POSM_DRAG_MIME = 'application/x-aisleris-posm'

export type PosmDragPayload = {
  id: string
  name: string
  posmType: string
  imageUrl?: string | null
  imageStorageKey?: string | null
}

type DropTarget =
  | { kind: 'bin'; binId: string; rackId: string }
  | { kind: 'row'; rowId: string; rackId: string }

function findDropTargetFromIntersects(
  intersects: THREE.Intersection[],
): DropTarget | null {
  const state = usePlanogramStore.getState()
  for (const hit of intersects) {
    let obj: THREE.Object3D | null = hit.object
    while (obj) {
      const id = obj.userData?.id
      const type = obj.userData?.type
      if (typeof id === 'string' && id.length > 0) {
        if (type === 'bin') {
          for (const rack of state.area.racks) {
            for (const side of rack.sides) {
              for (const row of side.rows) {
                if (row.bins.some((b) => b.id === id)) {
                  return { kind: 'bin', binId: id, rackId: rack.id }
                }
              }
            }
          }
        }
        if (type === 'row') {
          for (const rack of state.area.racks) {
            for (const side of rack.sides) {
              if (side.rows.some((r) => r.id === id)) {
                return { kind: 'row', rowId: id, rackId: rack.id }
              }
            }
          }
        }
        // Bare id that matches a bin first, then row
        for (const rack of state.area.racks) {
          for (const side of rack.sides) {
            for (const row of side.rows) {
              if (row.bins.some((b) => b.id === id)) {
                return { kind: 'bin', binId: id, rackId: rack.id }
              }
            }
            if (side.rows.some((r) => r.id === id)) {
              return { kind: 'row', rowId: id, rackId: rack.id }
            }
          }
        }
      }
      obj = obj.parent
    }
  }
  return null
}

/** Drag POSM from panel onto a bin (preferred) or row in the 3D scene. */
export function PosmDropHandler() {
  const { camera, gl, scene } = useThree()
  const assignBinItemTagPosm = usePlanogramStore((s) => s.assignBinItemTagPosm)
  const assignRowDividerPosm = usePlanogramStore((s) => s.assignRowDividerPosm)

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(POSM_DRAG_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }

    const onDrop = async (e: DragEvent) => {
      const raw = e.dataTransfer?.getData(POSM_DRAG_MIME)
      if (!raw) return
      e.preventDefault()
      e.stopPropagation()

      let payload: PosmDragPayload
      try {
        payload = JSON.parse(raw) as PosmDragPayload
      } catch {
        return
      }
      if (!payload?.id) return

      const rect = el.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      const ctx = findDropTargetFromIntersects(hits)
      if (!ctx) {
        usePlanogramStore.setState({
          addProductError: 'Drop the POSM onto a bin or row.',
        })
        return
      }

      const hydrated: RackSurfacePosm = {
        id: payload.id,
        name: payload.name,
        posmType: payload.posmType,
        imageUrl: payload.imageUrl ?? null,
        imageStorageKey: payload.imageStorageKey ?? null,
      }
      const res =
        ctx.kind === 'bin'
          ? await assignBinItemTagPosm(ctx.rackId, ctx.binId, payload.id, hydrated)
          : await assignRowDividerPosm(ctx.rackId, ctx.rowId, payload.id, hydrated)
      if (!res.success) {
        usePlanogramStore.setState({
          addProductError: res.message ?? 'Failed to assign POSM',
        })
      } else {
        usePlanogramStore.setState({ addProductError: null })
      }
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
    }
  }, [camera, gl, scene, assignBinItemTagPosm, assignRowDividerPosm])

  return null
}
