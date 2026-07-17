'use client'

import { Suspense, useMemo } from 'react'
import { Edges, useTexture } from '@react-three/drei'
import { DoubleSide, SRGBColorSpace, type Texture } from 'three'
import type { RackSurfacePosm } from '@/types/rackBlueprint'
import { resolvePosmImageUrl } from '@/utils/posmImageUrl'

const POSM_TYPE_COLORS: Record<string, string> = {
  Standee: '#8e44ad',
  ShelfTalker: '#27ae60',
  Flyer: '#2980b9',
}

function TalkerImage({
  url,
  width,
  height,
}: {
  url: string
  width: number
  height: number
}) {
  const texture = useTexture(url) as Texture
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])

  return (
    <mesh position={[0, 0, 0.009]} raycast={() => null}>
      <planeGeometry args={[width * 0.94, height * 0.9]} />
      <meshStandardMaterial
        map={texture}
        transparent
        toneMapped={false}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

/** Shelf-talker tag on the front lip when a divider POSM item is assigned. */
export function RowDividerPosmMesh({
  posm,
  rowWidth,
  rowHeight,
  shelfZ,
  onSelect,
}: {
  posm: RackSurfacePosm | null | undefined
  rowWidth: number
  rowHeight: number
  shelfZ: number
  onSelect?: (e: { stopPropagation: () => void }) => void
}) {
  if (!posm) return null

  const tagW = Math.min(Math.max(rowWidth * 0.35, 0.28), rowWidth * 0.85, 0.55)
  const tagH = 0.16
  const tagD = 0.018
  const color = POSM_TYPE_COLORS[posm.posmType] ?? '#2C5282'
  const lipY = -rowHeight / 2 + 0.06
  const imageUrl = resolvePosmImageUrl(posm)

  return (
    <group position={[0, lipY + tagH / 2, shelfZ - 0.06]} userData={{ type: 'dividerPosm' }}>
      <mesh
        onClick={onSelect}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      >
        <boxGeometry args={[tagW, tagH, tagD]} />
        <meshStandardMaterial
          color={imageUrl ? '#f8fafc' : color}
          emissive={imageUrl ? '#000000' : color}
          emissiveIntensity={imageUrl ? 0 : 0.55}
          metalness={0.1}
          roughness={0.45}
        />
        <Edges color="#ecf0f1" threshold={15} lineWidth={2} />
      </mesh>
      {imageUrl ? (
        <Suspense fallback={null}>
          <TalkerImage url={imageUrl} width={tagW} height={tagH} />
        </Suspense>
      ) : null}
    </group>
  )
}
