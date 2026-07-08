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
        // Prefer bins: walk ancestors if needed — bin groups set userData.id
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

/** HTML drag-and-drop from Product Library onto a bin mesh in the 3D scene. */
export function ProductDropHandler() {
  const { camera, gl, scene } = useThree()
  const placeProductOnBin = usePlanogramStore((s) => s.placeProductOnBin)
  const startProductPlacement = usePlanogramStore((s) => s.startProductPlacement)

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes(PRODUCT_DRAG_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }

    const onDrop = async (e: DragEvent) => {
      const raw = e.dataTransfer?.getData(PRODUCT_DRAG_MIME)
      if (!raw) return
      e.preventDefault()
      e.stopPropagation()

      let pending: PendingProductParams
      try {
        pending = JSON.parse(raw) as PendingProductParams
      } catch {
        return
      }
      if (!pending?.id) return

      startProductPlacement(pending)

      const rect = el.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      const binId = findBinIdFromIntersects(hits)
      if (!binId) {
        usePlanogramStore.setState({
          addProductError: 'Drop the product onto a bin (select/add a bin first).',
        })
        return
      }
      await placeProductOnBin(binId, 1)
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
    }
  }, [camera, gl, scene, placeProductOnBin, startProductPlacement])

  return null
}
