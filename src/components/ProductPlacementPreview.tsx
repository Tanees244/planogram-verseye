'use client'

import { Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import type { Mesh, MeshStandardMaterial } from 'three'
import { fitObjectToBox } from '@/utils/fitGlbToBox'
import { resolveProductModelUrl } from '@/utils/productModelUrl'

/** Ghost facing shown on a bin while placing / dragging a SKU. */
export function ProductPlacementPreview({
  position,
  width,
  height,
  depth,
  fits,
  color = '#10b981',
  modelUrl,
  modelStorageKey,
}: {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  fits: boolean
  color?: string
  modelUrl?: string | null
  modelStorageKey?: string | null
}) {
  const resolved = resolveProductModelUrl({
    modelUrl: modelUrl ?? undefined,
    modelStorageKey: modelStorageKey ?? undefined,
  })
  const ghostColor = fits ? color : '#ef4444'

  return (
    <group position={position} raycast={() => null}>
      {resolved ? (
        <Suspense fallback={<GhostBox width={width} height={height} depth={depth} color={ghostColor} />}>
          <GhostGlb url={resolved} width={width} height={height} depth={depth} color={ghostColor} />
        </Suspense>
      ) : (
        <GhostBox width={width} height={height} depth={depth} color={ghostColor} />
      )}
      <mesh position={[0, -height / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[width * 1.05, depth * 1.05]} />
        <meshBasicMaterial color={ghostColor} transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}

function GhostBox({
  width,
  height,
  depth,
  color,
}: {
  width: number
  height: number
  depth: number
  color: string
}) {
  return (
    <group raycast={() => null}>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.4}
          depthWrite={false}
          emissive={color}
          emissiveIntensity={0.35}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.75} depthWrite={false} />
      </mesh>
    </group>
  )
}

function GhostGlb({
  url,
  width,
  height,
  depth,
  color,
}: {
  url: string
  width: number
  height: number
  depth: number
  color: string
}) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    fitObjectToBox(clone, width, height, depth, 'stretch')
    clone.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.raycast = () => null
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((mat) => ghostifyMaterial(mat as MeshStandardMaterial, color))
      } else if (mesh.material) {
        mesh.material = ghostifyMaterial(mesh.material as MeshStandardMaterial, color)
      }
    })
    return clone
  }, [scene, width, height, depth, color])

  return (
    <group raycast={() => null}>
      <primitive object={model} />
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ghostifyMaterial(mat: MeshStandardMaterial, color: string): MeshStandardMaterial {
  const cloned = mat.clone()
  cloned.transparent = true
  cloned.opacity = 0.55
  cloned.depthWrite = false
  if (cloned.emissive) {
    cloned.emissive.set(color)
    cloned.emissiveIntensity = 0.35
  }
  return cloned
}
