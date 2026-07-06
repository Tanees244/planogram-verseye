// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Warehouse pallet display — low wooden base with optional wrap band. */
export function PalletDisplayFixture({
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
  const palletH = 0.15
  const slatCount = 5
  const slatW = rack.width / slatCount

  return (
    <>
      {/* Pallet deck slats */}
      {Array.from({ length: slatCount }).map((_, i) => (
        <mesh
          key={`slat-${i}`}
          position={[-rack.width / 2 + slatW * (i + 0.5), -rackHeight / 2 + palletH / 2, 0]}
          {...bind}
        >
          <boxGeometry args={[slatW * 0.88, palletH, rack.depth * 0.92]} />
          <meshStandardMaterial
            color="#8B6914"
            metalness={0.1}
            roughness={0.85}
            emissive={emissive}
            emissiveIntensity={0.1}
          />
        </mesh>
      ))}

      {/* Pallet blocks (corners) */}
      {[
        [-rack.width / 2 + 0.08, -rack.depth / 2 + 0.08],
        [rack.width / 2 - 0.08, -rack.depth / 2 + 0.08],
        [-rack.width / 2 + 0.08, rack.depth / 2 - 0.08],
        [rack.width / 2 - 0.08, rack.depth / 2 - 0.08],
      ].map(([x, z], i) => (
        <mesh key={`block-${i}`} position={[x, -rackHeight / 2 + 0.04, z]} {...bind}>
          <boxGeometry args={[0.14, 0.08, 0.14]} />
          <meshStandardMaterial color="#6d4c1a" roughness={0.9} />
        </mesh>
      ))}

      {/* Shrink-wrap band */}
      <mesh position={[0, -rackHeight / 2 + rackHeight * 0.55, 0]} {...bind}>
        <boxGeometry args={[rack.width + 0.02, rackHeight * 0.35, rack.depth + 0.02]} />
        <meshStandardMaterial
          color="#FFFFFF"
          transparent
          opacity={0.12}
          metalness={0.1}
          roughness={0.2}
          emissive={emissive}
          emissiveIntensity={0.05}
        />
        <Edges color="#bdc3c7" lineWidth={1} />
      </mesh>

      {/* Corner posts for stacked display */}
      {[
        [-rack.width / 2 + 0.04, -rack.depth / 2 + 0.04],
        [rack.width / 2 - 0.04, -rack.depth / 2 + 0.04],
        [-rack.width / 2 + 0.04, rack.depth / 2 - 0.04],
        [rack.width / 2 - 0.04, rack.depth / 2 - 0.04],
      ].map(([x, z], i) => (
        <mesh key={`post-${i}`} position={[x, 0, z]} {...bind}>
          <boxGeometry args={[0.05, rackHeight - palletH, 0.05]} />
          <meshStandardMaterial color="#95a5a6" metalness={0.6} roughness={0.35} emissive={emissive} emissiveIntensity={0.12} />
        </mesh>
      ))}

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
