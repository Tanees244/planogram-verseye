'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { captureRackFromRenderer, registerSceneCapture } from '@/utils/captureRackScene'

/** Registers a 3D capture that isolates the rack from the warehouse scene. */
export function SceneCaptureBridge() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    registerSceneCapture((opts) => captureRackFromRenderer(gl, scene, camera, opts))
    return () => registerSceneCapture(null)
  }, [gl, scene, camera])

  return null
}
