// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Upright freezer cabinet — insulated shell, frosted door, cold zone. */
export function FreezerFixture({
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
  const emissive = hovered || isSelected ? '#2C5282' : '#5dade2'
  const wallT = 0.12
  const doorZ = -rack.depth / 2 + wallT / 2

  return (
    <>
      {/* Insulated outer body */}
      <mesh position={[0, 0, 0]} {...bind}>
        <boxGeometry args={[rack.width, rackHeight, rack.depth]} />
        <meshStandardMaterial color="#f8f9f9" metalness={0.25} roughness={0.65} emissive={emissive} emissiveIntensity={0.08} />
        <Edges color="#bdc3c7" lineWidth={2} />
      </mesh>

      {/* Inner frost chamber */}
      <mesh position={[0, 0, rack.depth * 0.04]}>
        <boxGeometry args={[rack.width - wallT, rackHeight - wallT, rack.depth - wallT * 1.5]} />
        <meshStandardMaterial color="#ebf5fb" metalness={0.05} roughness={0.95} emissive="#d6eaf8" emissiveIntensity={0.2} />
      </mesh>

      {/* Frosted door */}
      <mesh position={[0, 0, doorZ]} {...bind}>
        <boxGeometry args={[rack.width * 0.88, rackHeight * 0.9, wallT * 0.8]} />
        <meshStandardMaterial color="#eaf2f8" transparent opacity={0.75} roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Freezer lid line (top seam) */}
      <mesh position={[0, rackHeight / 2 - 0.04, 0]} {...bind}>
        <boxGeometry args={[rack.width + 0.02, 0.06, rack.depth + 0.02]} />
        <meshStandardMaterial color="#d5dbdb" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Temperature display */}
      <mesh position={[rack.width / 2 - 0.18, rackHeight / 2 - 0.2, doorZ + 0.05]}>
        <boxGeometry args={[0.22, 0.1, 0.02]} />
        <meshStandardMaterial color="#1b2631" emissive="#2C5282" emissiveIntensity={0.4} />
      </mesh>

      {/* Snowflake icon block */}
      <mesh position={[-rack.width / 2 + 0.15, rackHeight / 2 - 0.18, doorZ + 0.05]}>
        <boxGeometry args={[0.12, 0.12, 0.02]} />
        <meshStandardMaterial color="#85c1e9" emissive="#aed6f1" emissiveIntensity={0.5} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
