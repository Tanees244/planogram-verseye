// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Open or glass-door chilled cabinet for dairy, juice, chilled foods. */
export function RefrigeratedFixture({
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
  const emissive = hovered || isSelected ? '#2C5282' : '#1abc9c'
  const frameT = 0.08
  const glassZ = -rack.depth / 2 + 0.04

  return (
    <>
      {/* Outer shell */}
      <mesh position={[0, 0, 0]} {...bind}>
        <boxGeometry args={[rack.width, rackHeight, rack.depth]} />
        <meshStandardMaterial color="#ecf0f1" metalness={0.55} roughness={0.35} emissive={emissive} emissiveIntensity={hovered ? 0.2 : 0.05} />
        <Edges color="#95a5a6" lineWidth={1.5} />
      </mesh>

      {/* Cavity (hollow look — inner tint) */}
      <mesh position={[0, 0, rack.depth * 0.05]}>
        <boxGeometry args={[rack.width - frameT * 2, rackHeight - frameT * 2, rack.depth - frameT]} />
        <meshStandardMaterial color="#d6eaf8" metalness={0.1} roughness={0.8} emissive="#aed6f1" emissiveIntensity={0.15} />
      </mesh>

      {/* Glass door */}
      <mesh position={[0, 0, glassZ]} {...bind}>
        <boxGeometry args={[rack.width * 0.92, rackHeight * 0.88, 0.03]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.35}
          metalness={0.8}
          roughness={0.1}
          emissive={emissive}
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Door handle */}
      <mesh position={[rack.width / 2 - 0.12, 0, glassZ + 0.04]} {...bind}>
        <boxGeometry args={[0.04, rackHeight * 0.25, 0.06]} />
        <meshStandardMaterial color="#7f8c8d" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* LED strip */}
      <mesh position={[0, rackHeight / 2 - 0.06, -rack.depth / 2 + 0.06]}>
        <boxGeometry args={[rack.width * 0.85, 0.04, 0.04]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} />
      </mesh>

      {/* Cooler badge */}
      <mesh position={[-rack.width / 2 + 0.2, rackHeight / 2 - 0.15, -rack.depth / 2 + 0.05]}>
        <boxGeometry args={[0.35, 0.12, 0.02]} />
        <meshStandardMaterial color="#2C5282" emissive="#2C5282" emissiveIntensity={0.3} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
