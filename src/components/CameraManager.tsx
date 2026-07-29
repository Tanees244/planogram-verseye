'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Box3, Euler, Vector3, type Object3D } from 'three'
import { isValidBox3 } from '@/utils/threeBounds'
import { usePlanogramStore, type Rack } from '@/store/planogramStore'
import type { CameraControls } from '@react-three/drei'

function findObjectById(scene: Object3D, id: string): Object3D | null {
  let found: Object3D | null = null
  scene.traverse((obj) => {
    if (!found && obj.userData?.id === id) found = obj
  })
  return found
}

function findRackForSelection(
  racks: Rack[],
  selectedId: string,
  selectedType: string | null,
): Rack | null {
  if (selectedType === 'rack') {
    return racks.find((r) => r.id === selectedId) ?? null
  }
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        if (selectedType === 'row' && row.id === selectedId) return rack
        for (const bin of row.bins) {
          if (selectedType === 'bin' && bin.id === selectedId) return rack
          if (
            selectedType === 'product' &&
            bin.products.some((p) => p.id === selectedId || p.id.startsWith(`${selectedId}::`))
          ) {
            return rack
          }
        }
      }
    }
  }
  return null
}

/**
 * Soft-focus the selection without swinging to the rack's narrow side.
 * Bins sit along X, so "outward = rackCenter → bin" wrongly put the camera
 * at the left/right end — showing only a side silhouette.
 */
export function CameraManager({
  controlsRef,
}: {
  controlsRef: React.RefObject<CameraControls | null>
}) {
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const selectedType = usePlanogramStore((s) => s.selectedType)
  const racks = usePlanogramStore((s) => s.area.racks)
  const { scene, camera } = useThree()
  const lastSelectedId = useRef<string | null>(null)

  useEffect(() => {
    if (selectedType === 'area') return

    const controls = controlsRef.current
    if (!controls || !selectedId) {
      if (!selectedId) lastSelectedId.current = null
      return
    }
    if (selectedId === lastSelectedId.current) return
    lastSelectedId.current = selectedId

    const rack = findRackForSelection(racks, selectedId, selectedType)
    const targetObj =
      findObjectById(scene, selectedId) ??
      (rack ? findObjectById(scene, rack.id) : null)
    if (!targetObj) return

    const focusBox = new Box3().setFromObject(targetObj)
    if (!isValidBox3(focusBox)) return

    const focusCenter = focusBox.getCenter(new Vector3())
    const focusSize = focusBox.getSize(new Vector3())

    let frameBox = focusBox
    if (rack) {
      const rackObj = findObjectById(scene, rack.id)
      if (rackObj) {
        const rackBox = new Box3().setFromObject(rackObj)
        if (isValidBox3(rackBox)) frameBox = rackBox
      }
    }

    const frameCenter = frameBox.getCenter(new Vector3())
    const frameSize = frameBox.getSize(new Vector3())
    const yaw = rack?.rotation?.y ?? 0

    const depth = Math.max(frameSize.z, frameSize.x * 0.45, 1)
    const width = Math.max(frameSize.x, 1)
    const standOff = Math.max(depth * 1.25 + 2.2, width * 0.45 + 1.8, 3.5)

    const lookAt = focusCenter.clone()

    // Rack local depth axis (±Z). Shopper front is typically −Z.
    const localPosZ = new Vector3(0, 0, 1).applyEuler(new Euler(0, yaw, 0)).normalize()
    const localNegZ = localPosZ.clone().negate()

    const camFromCenter = new Vector3(
      camera.position.x - frameCenter.x,
      0,
      camera.position.z - frameCenter.z,
    )
    const cameraOnNegZ =
      camFromCenter.lengthSq() < 0.01
        ? true
        : camFromCenter.dot(localNegZ) >= camFromCenter.dot(localPosZ)

    const outward = new Vector3()
    const isShelfPick =
      selectedType === 'bin' || selectedType === 'row' || selectedType === 'product'
    const isDoubleSided = Boolean(rack?.isDoubleSided)

    if (isShelfPick) {
      // Keep the face the user is already looking at — never jump to the rack end.
      outward.copy(cameraOnNegZ ? localNegZ : localPosZ)
    } else if (isDoubleSided) {
      const toFocus = focusCenter.clone().sub(frameCenter)
      const onPosZ = toFocus.dot(localPosZ) >= 0
      outward.copy(onPosZ ? localPosZ : localNegZ)
    } else {
      // Single-sided rack: always frame the shopper / open front (−Z), not the back panel.
      outward.copy(localNegZ)
    }

    const camPos = lookAt.clone().addScaledVector(outward, standOff)
    camPos.y = lookAt.y + Math.max(focusSize.y * 0.35, frameSize.y * 0.2, 0.55)

    void controls.setLookAt(
      camPos.x,
      camPos.y,
      camPos.z,
      lookAt.x,
      lookAt.y,
      lookAt.z,
      true,
    )
  }, [selectedId, selectedType, scene, controlsRef, racks, camera])

  return null
}
