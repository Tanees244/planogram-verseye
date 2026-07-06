// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** End-of-aisle cap — wedge footprint, header board, open front. */
export function EndCapFixture({
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
  const emissive = hovered || isSelected ? '#2C5282' : '#000000'
  const headerH = 0.35
  const baseH = 0.12
  const innerH = rackHeight - headerH - baseH

  return (
    <>
      {/* Base platform */}
      <mesh position={[0, -rackHeight / 2 + baseH / 2, 0]} {...bind}>
        <boxGeometry args={[rack.width, baseH, rack.depth]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.4} roughness={0.5} emissive={emissive} emissiveIntensity={0.2} />
        <Edges color="#2c3e50" lineWidth={2} />
      </mesh>

      {/* Header / sign board */}
      <mesh position={[0, rackHeight / 2 - headerH / 2, -rack.depth * 0.15]} {...bind}>
        <boxGeometry args={[rack.width * 0.95, headerH, rack.depth * 0.25]} />
        <meshStandardMaterial color="#e74c3c" metalness={0.25} roughness={0.55} emissive={hovered ? '#c0392b' : '#000000'} emissiveIntensity={0.25} />
        <Edges color="#922b21" lineWidth={2} />
      </mesh>

      {/* Angled side wings (trapezoid feel) */}
      {[-1, 1].map((sign) => (
        <mesh
          key={`wing-${sign}`}
          position={[sign * (rack.width / 2 - 0.04), 0, rack.depth * 0.1]}
          rotation={[0, sign * 0.35, 0]}
          {...bind}
        >
          <boxGeometry args={[0.06, innerH, rack.depth * 0.7]} />
          <meshStandardMaterial color="#ecf0f1" metalness={0.35} roughness={0.5} emissive={emissive} emissiveIntensity={0.12} />
        </mesh>
      ))}

      {/* Back panel */}
      <mesh position={[0, 0, rack.depth / 2 - 0.03]} {...bind}>
        <boxGeometry args={[rack.width * 0.9, innerH, 0.06]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.4} roughness={0.5} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
