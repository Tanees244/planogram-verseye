'use client'

import { Edges } from '@react-three/drei'
import type { ShelfTalker } from '@/types/rackBlueprint'

/** Simple front-lip shelf talkers placed along a row. */
export function ShelfTalkerMeshes({
  talkers,
  rowWidth,
  rowHeight,
  shelfZ = 0,
}: {
  talkers: ShelfTalker[]
  rowWidth: number
  rowHeight: number
  shelfZ?: number
}) {
  if (!talkers.length) return null
  const count = talkers.length

  return (
    <group>
      {talkers.map((t, idx) => {
        const slot = Math.max(1, t.slotPosition)
        const x =
          count === 1
            ? 0
            : -rowWidth / 2 + (rowWidth / (count + 1)) * Math.min(slot, count)
        const y = -rowHeight / 2 + t.outerHeight / 2 + 0.02
        const z = shelfZ - 0.02
        return (
          <mesh key={t.id} position={[x, y, z]} userData={{ id: t.id, type: 'shelfTalker' }}>
            <boxGeometry args={[Math.min(t.length, rowWidth * 0.9), t.outerHeight, Math.max(0.02, t.innerDepth)]} />
            <meshStandardMaterial color="#f6e05e" metalness={0.1} roughness={0.6} />
            <Edges color="#b7791f" threshold={15} />
          </mesh>
        )
      })}
    </group>
  )
}
