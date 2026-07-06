// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Checkout impulse rack — low counter tiers beside POS. */
export function CheckoutFixture({
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
  const counterH = Math.min(0.85, rackHeight * 0.35)
  const tierCount = 3
  const tierH = (rackHeight - counterH) / tierCount

  return (
    <>
      {/* Main counter body */}
      <mesh position={[0, -rackHeight / 2 + counterH / 2, 0]} {...bind}>
        <boxGeometry args={[rack.width, counterH, rack.depth]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.35} roughness={0.55} emissive={emissive} emissiveIntensity={0.15} />
        <Edges color="#1a252f" lineWidth={2} />
      </mesh>

      {/* Counter top surface */}
      <mesh position={[0, -rackHeight / 2 + counterH + 0.02, 0]} {...bind}>
        <boxGeometry args={[rack.width + 0.04, 0.04, rack.depth + 0.04]} />
        <meshStandardMaterial color="#ecf0f1" metalness={0.5} roughness={0.35} />
      </mesh>

      {/* Impulse shelf tiers above counter */}
      {Array.from({ length: tierCount }).map((_, i) => {
        const y = -rackHeight / 2 + counterH + tierH * (i + 0.5)
        const depthScale = 1 - i * 0.12
        return (
          <group key={`tier-${i}`}>
            <mesh position={[0, y, rack.depth * 0.05 * i]} {...bind}>
              <boxGeometry args={[rack.width * 0.92, 0.04, rack.depth * depthScale * 0.85]} />
              <meshStandardMaterial color="#FFFFFF" metalness={0.4} roughness={0.5} emissive={emissive} emissiveIntensity={0.1} />
            </mesh>
            <mesh position={[-rack.width / 2 + 0.04, y, 0]} {...bind}>
              <boxGeometry args={[0.05, tierH * 0.9, rack.depth * 0.7]} />
              <meshStandardMaterial color="#bdc3c7" metalness={0.45} roughness={0.5} />
            </mesh>
            <mesh position={[rack.width / 2 - 0.04, y, 0]} {...bind}>
              <boxGeometry args={[0.05, tierH * 0.9, rack.depth * 0.7]} />
              <meshStandardMaterial color="#bdc3c7" metalness={0.45} roughness={0.5} />
            </mesh>
          </group>
        )
      })}

      {/* Candy/gum divider rail */}
      <mesh position={[0, -rackHeight / 2 + counterH + 0.08, -rack.depth / 2 + 0.04]} {...bind}>
        <boxGeometry args={[rack.width * 0.8, 0.06, 0.04]} />
        <meshStandardMaterial color="#e74c3c" metalness={0.3} roughness={0.5} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
