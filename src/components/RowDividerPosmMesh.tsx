'use client'

import { Edges } from '@react-three/drei'
import { DoubleSide } from 'three'
import type { RackSurfacePosm } from '@/types/rackBlueprint'
import { usePosmImageSrc } from '@/hooks/usePosmImageSrc'
import { usePosmTexture } from '@/hooks/usePosmTexture'

const POSM_TYPE_COLORS: Record<string, string> = {
  Standee: '#8e44ad',
  ShelfTalker: '#27ae60',
  Flyer: '#2980b9',
}

function TalkerImage({
  url,
  width,
  height,
  frontZ,
}: {
  url: string
  width: number
  height: number
  /** Local Z of the plaque front face (negative = toward aisle / camera). */
  frontZ: number
}) {
  const texture = usePosmTexture(url)

  if (!texture) return null

  // Front of planeGeometry faces +Z; rotate so it faces the aisle (−Z).
  return (
    <mesh
      position={[0, 0, frontZ - 0.002]}
      rotation={[0, Math.PI, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[width * 0.94, height * 0.9]} />
      <meshBasicMaterial
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
  const imageUrl = usePosmImageSrc(posm)

  if (!posm) return null

  const tagW = Math.min(Math.max(rowWidth * 0.2, 0.12), rowWidth * 0.5, 0.28)
  const tagH = 0.09
  const tagD = 0.012
  const color = POSM_TYPE_COLORS[posm.posmType] ?? '#2C5282'
  const lipY = -rowHeight / 2 + 0.04
  const frontZ = -tagD / 2

  return (
    <group position={[0, lipY + tagH / 2, shelfZ - 0.04]} userData={{ type: 'dividerPosm' }}>
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
        <Edges color="#ecf0f1" threshold={15} lineWidth={1} />
      </mesh>
      {imageUrl ? (
        <TalkerImage url={imageUrl} width={tagW} height={tagH} frontZ={frontZ} />
      ) : null}
    </group>
  )
}
