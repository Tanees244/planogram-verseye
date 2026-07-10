'use client'

import { Edges } from '@react-three/drei'
import type { RackSurfacePosm } from '@/types/rackBlueprint'

const POSM_TYPE_COLORS: Record<string, string> = {
  Standee: '#8e44ad',
  ShelfTalker: '#27ae60',
  Flyer: '#2980b9',
}

/** Visual shelf-talker tag on the front lip when a divider POSM item is assigned. */
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

  const tagW = Math.min(rowWidth * 0.22, 0.32)
  const tagH = 0.14
  const tagD = 0.015
  const color = POSM_TYPE_COLORS[posm.posmType] ?? '#2C5282'
  const lipY = -rowHeight / 2 + 0.06

  return (
    <group position={[0, lipY + tagH / 2, shelfZ - 0.05]} userData={{ type: 'dividerPosm' }}>
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
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          metalness={0.15}
          roughness={0.4}
        />
        <Edges color="#ecf0f1" threshold={15} lineWidth={2} />
      </mesh>
    </group>
  )
}

