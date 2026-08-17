'use client'

import { usePlanogramStore } from '@/store/planogramStore'

/** Invisible (or faintly highlighted) hit planes for POSM drops on shell surfaces. */
export function RackPosmDropTargets({
  width,
  height,
  depth,
}: {
  width: number
  height: number
  depth: number
}) {
  const dragging = usePlanogramStore((s) => s.posmDragActive)
  if (!dragging) return null

  const w = Math.max(width, 0.4)
  const h = Math.max(height, 0.6)
  const d = Math.max(depth, 0.3)
  const headerH = Math.min(0.32, h * 0.14)
  const footerH = Math.min(0.22, h * 0.1)
  const wallT = 0.06

  const mat = (
    <meshBasicMaterial
      color="#8b5cf6"
      transparent
      opacity={0.22}
      depthWrite={false}
    />
  )

  return (
    <group>
      <mesh
        position={[0, h / 2 - headerH / 2, -d / 2 - 0.03]}
        userData={{ type: 'rack-wall', wall: 'header' }}
        renderOrder={30}
      >
        <boxGeometry args={[w * 0.98, headerH, 0.05]} />
        {mat}
      </mesh>
      <mesh
        position={[0, -h / 2 + footerH / 2, -d / 2 - 0.03]}
        userData={{ type: 'rack-wall', wall: 'footer' }}
        renderOrder={30}
      >
        <boxGeometry args={[w * 0.98, footerH, 0.05]} />
        {mat}
      </mesh>
      <mesh
        position={[-w / 2 - wallT / 2, 0, 0]}
        userData={{ type: 'rack-wall', wall: 'left' }}
        renderOrder={30}
      >
        <boxGeometry args={[wallT, h * 0.92, d * 0.98]} />
        {mat}
      </mesh>
      <mesh
        position={[w / 2 + wallT / 2, 0, 0]}
        userData={{ type: 'rack-wall', wall: 'right' }}
        renderOrder={30}
      >
        <boxGeometry args={[wallT, h * 0.92, d * 0.98]} />
        {mat}
      </mesh>
    </group>
  )
}
