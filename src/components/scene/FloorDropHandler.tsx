'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlanogramStore } from '@/store/planogramStore'
import { DRAG_MIME } from '@/components/FixturePalette'
import { buildPendingRackFromFixture } from '@/utils/fixturePlacement'
import { snapRackToWall } from '@/utils/rackPlacement'
import type { FixtureType } from '@/components/fixtures/types'
import { FIXTURE_LIBRARY } from '@/components/fixtures/types'

/** Handles HTML drag-and-drop from the fixture palette onto the 3D floor. */
export function FloorDropHandler() {
  const { camera, gl } = useThree()
  const addRackToServer = usePlanogramStore((s) => s.addRackToServer)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const areaWidth = usePlanogramStore((s) => s.area.width)
  const areaDepth = usePlanogramStore((s) => s.area.depth)

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02)
    const hit = new THREE.Vector3()

    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      const raw = e.dataTransfer?.getData(DRAG_MIME)
      if (!raw || !(raw in FIXTURE_LIBRARY)) return
      const fixtureType = raw as FixtureType

      if (!selectedStoreId) return

      const rect = el.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      if (!raycaster.ray.intersectPlane(floorPlane, hit)) return

      const params = buildPendingRackFromFixture(fixtureType, usePlanogramStore.getState())
      const snapped = snapRackToWall(
        { x: hit.x, z: hit.z },
        params.width,
        params.depth,
        areaWidth,
        areaDepth,
      )
      await addRackToServer(
        { x: snapped.x, y: 0, z: snapped.z },
        params,
        selectedStoreId,
        { rotationY: snapped.rotationY },
      )
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
    }
  }, [camera, gl, addRackToServer, selectedStoreId, areaWidth, areaDepth])

  return null
}
