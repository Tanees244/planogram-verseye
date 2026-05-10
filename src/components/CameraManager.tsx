// @ts-nocheck
'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Box3 } from 'three'
import { usePlanogramStore } from '@/store/planogramStore'
import type { CameraControls } from '@react-three/drei'

export function CameraManager({ controlsRef }: { controlsRef: React.RefObject<CameraControls> }) {
  const { selectedId, selectedType } = usePlanogramStore()
  const { scene } = useThree()
  // Keep track of the last selected ID to avoid re-triggering on every render
  const lastSelectedId = useRef<string | null>(null)

  useEffect(() => {
    // Don't span camera for area
    if (selectedType === 'area') {
      return
    }

    // Only proceed if we have controls and a NEW selection
    if (!controlsRef.current || !selectedId || selectedId === lastSelectedId.current) {
      // If selection is cleared, we reset our tracker
      if (!selectedId) lastSelectedId.current = null
      return
    }

    lastSelectedId.current = selectedId

    // Find the object
    let targetObj: any = null
    scene.traverse((obj) => {
      if (obj.userData?.id === selectedId) {
        targetObj = obj
      }
    })

    if (targetObj) {
      const box = new Box3().setFromObject(targetObj)

      // Use fitToBox for smooth zoom to the object
      // Padding ensures we don't zoom in TOO close (sticking camera inside object)
      controlsRef.current.fitToBox(box, true, {
        paddingLeft: 2,
        paddingRight: 2,
        paddingTop: 2,
        paddingBottom: 2
      })
    }

  }, [selectedId, selectedType, scene, controlsRef])

  return null
}
