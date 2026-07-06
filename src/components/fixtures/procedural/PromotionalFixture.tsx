// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Temporary promotional island — bold header, open display tiers. */
export function PromotionalFixture({
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
  const emissive = hovered || isSelected ? '#2C5282' : '#e74c3c'
  const headerH = Math.min(0.5, rackHeight * 0.22)
  const baseH = 0.14

  return (
    <>
      {/* Island base plinth */}
      <mesh position={[0, -rackHeight / 2 + baseH / 2, 0]} {...bind}>
        <boxGeometry args={[rack.width, baseH, rack.depth]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.4} roughness={0.5} emissive={emissive} emissiveIntensity={0.1} />
        <Edges color="#1a252f" lineWidth={2} />
      </mesh>

      {/* Corner posts */}
      {[
        [-rack.width / 2 + 0.05, -rack.depth / 2 + 0.05],
        [rack.width / 2 - 0.05, -rack.depth / 2 + 0.05],
        [-rack.width / 2 + 0.05, rack.depth / 2 - 0.05],
        [rack.width / 2 - 0.05, rack.depth / 2 - 0.05],
      ].map(([x, z], i) => (
        <mesh key={`post-${i}`} position={[x, 0, z]} {...bind}>
          <boxGeometry args={[0.08, rackHeight - baseH, 0.08]} />
          <meshStandardMaterial color="#FFFFFF" metalness={0.45} roughness={0.45} emissive={emissive} emissiveIntensity={0.12} />
        </mesh>
      ))}

      {/* Promo header / campaign banner */}
      <mesh position={[0, rackHeight / 2 - headerH / 2, 0]} {...bind}>
        <boxGeometry args={[rack.width * 0.96, headerH, rack.depth * 0.35]} />
        <meshStandardMaterial color="#e74c3c" metalness={0.2} roughness={0.55} emissive="#c0392b" emissiveIntensity={hovered ? 0.35 : 0.2} />
        <Edges color="#922b21" lineWidth={2} />
      </mesh>

      {/* Side wings (open L-shape merchandising) */}
      {[-1, 1].map((sign) => (
        <mesh
          key={`wing-${sign}`}
          position={[sign * (rack.width / 2 - 0.03), 0, 0]}
          {...bind}
        >
          <boxGeometry args={[0.05, rackHeight * 0.75, rack.depth * 0.85]} />
          <meshStandardMaterial color="#f1948a" metalness={0.25} roughness={0.6} emissive={emissive} emissiveIntensity={0.08} />
        </mesh>
      ))}

      {/* Center spotlight */}
      <mesh position={[0, rackHeight / 2 - headerH - 0.08, -rack.depth / 2 + 0.06]}>
        <boxGeometry args={[0.2, 0.06, 0.06]} />
        <meshStandardMaterial color="#f1c40f" emissive="#f39c12" emissiveIntensity={0.7} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
