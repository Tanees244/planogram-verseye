'use client'

import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
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
      if (mesh.isMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData = { ...mesh.userData, id: productId, type: 'product' }
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

  const scale = isSelected ? 1.1 : hovered ? 1.05 : 1

  return (
    <group
      ref={groupRef}
      scale={[scale, scale, scale]}
      userData={{ id: productId, type: 'product' }}
      onClick={onSelect}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    />
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
