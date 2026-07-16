'use client'

import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import { fitObjectToBox } from '@/utils/fitGlbToBox'

interface ProductGlbModelProps {
  url: string
  width: number
  height: number
  depth: number
  productId: string
  isSelected: boolean
  hovered: boolean
  onSelect: (e: unknown) => void
  onPointerOver: (e: unknown) => void
  onPointerOut: () => void
}

function setEmissive(root: Group, selected: boolean, hovered: boolean) {
  root.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      const m = mat as MeshStandardMaterial
      if (!m || !('emissive' in m)) continue
      m.emissive?.set?.(selected || hovered ? '#ffffff' : '#000000')
      m.emissiveIntensity = selected ? 0.25 : hovered ? 0.35 : 0
    }
  })
}

function GlbMesh({
  url,
  width,
  height,
  depth,
  productId,
  isSelected,
  hovered,
  onSelect,
  onPointerOver,
  onPointerOut,
}: ProductGlbModelProps) {
  const groupRef = useRef<Group>(null)
  const { scene } = useGLTF(url)

  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.raycast = () => null
      mesh.userData = { ...mesh.userData, id: productId, type: 'product' }
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => m.clone())
      } else if (mesh.material) {
        mesh.material = mesh.material.clone()
      }
    })
    fitObjectToBox(clone, width, height, depth)
    return clone
  }, [scene, width, height, depth, productId])

  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    while (g.children.length) g.remove(g.children[0])
    g.add(model)
  }, [model])

  useLayoutEffect(() => {
    setEmissive(model, isSelected, hovered)
  }, [model, isSelected, hovered])

  return (
    <group userData={{ id: productId, type: 'product' }}>
      {/* Stable hit box — never scales, prevents hover flicker */}
      <mesh
        userData={{ id: productId, type: 'product' }}
        onClick={onSelect}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={groupRef} />
    </group>
  )
}

export function ProductGlbModel(props: ProductGlbModelProps) {
  return <GlbMesh {...props} />
}

/** Call from parent when URL is known to warm the drei cache. */
export function preloadProductGlb(url: string) {
  try {
    useGLTF.preload(url)
  } catch {
    /* ignore — preload is best-effort */
  }
}
