// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Tall wall-mounted bay — solid back panel, open front shelves. */
export function WallBayFixture({
  rack,
  rackHeight,
  hasContent,
  hovered,
  isSelected,
  onSelect,
  onPointerOver,
  onPointerOut,
}: FixtureShellProps) {
  const bind = { onClick: onSelect, onPointerOver, onPointerOut }
  const backZ = rack.depth / 2 - 0.04
  const emissive = hovered || isSelected ? '#2C5282' : '#000000'

  return (
    <>
      {/* Back panel (local +Z — mounts to wall; open shelves face −Z) */}
      <mesh position={[0, 0, backZ]} {...bind}>
        <boxGeometry args={[rack.width, rackHeight, 0.08]} />
        <meshStandardMaterial color="#e8ecef" metalness={0.2} roughness={0.7} emissive={emissive} emissiveIntensity={0.15} />
        <Edges color="#7f8c8d" lineWidth={1.5} />
      </mesh>

      {/* Side uprights */}
      {[-rack.width / 2 + 0.06, rack.width / 2 - 0.06].map((x, i) => (
        <mesh key={`upright-${i}`} position={[x, 0, 0]} {...bind}>
          <boxGeometry args={[0.1, rackHeight, rack.depth * 0.85]} />
          <meshStandardMaterial color="#FFFFFF" metalness={0.5} roughness={0.45} emissive={emissive} emissiveIntensity={0.2} />
        </mesh>
      ))}

      {/* Top cap */}
      <mesh position={[0, rackHeight / 2 - 0.04, 0]} {...bind}>
        <boxGeometry args={[rack.width + 0.05, 0.08, rack.depth]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.55} roughness={0.4} emissive={emissive} emissiveIntensity={0.15} />
      </mesh>

      {/* Base kick plate */}
      <mesh position={[0, -rackHeight / 2 + 0.06, 0]} {...bind}>
        <boxGeometry args={[rack.width, 0.12, rack.depth]} />
        <meshStandardMaterial color="#bdc3c7" metalness={0.3} roughness={0.6} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
