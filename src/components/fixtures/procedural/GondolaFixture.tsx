// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

const metal = (hovered: boolean, isSelected: boolean) => ({
  color: '#FFFFFF',
  metalness: 0.65,
  roughness: 0.35,
  emissive: hovered || isSelected ? '#2C5282' : '#000000',
  emissiveIntensity: hovered ? 0.3 : isSelected ? 0.15 : 0,
})

/** Standard aisle gondola — single or double-sided (existing rack geometry). */
export function GondolaFixture({
  rack,
  rackHeight,
  hasContent,
  hovered,
  isSelected,
  onSelect,
  onPointerOver,
  onPointerOut,
}: FixtureShellProps) {
  const isDoubleSided = Boolean(rack.isDoubleSided) || rack.sides.length >= 2
  const bind = { onClick: onSelect, onPointerOver, onPointerOut }

  return (
    <>
      {hasContent && (
        <>
          {[
            [-rack.width / 2, -rack.depth / 2],
            [rack.width / 2, -rack.depth / 2],
            [-rack.width / 2, rack.depth / 2],
            [rack.width / 2, rack.depth / 2],
          ].map(([x, z], i) => (
            <mesh key={`post-${i}`} position={[x, 0, z]} {...bind}>
              <boxGeometry args={[0.15, rackHeight, 0.15]} />
              <meshStandardMaterial {...metal(hovered, isSelected)} />
            </mesh>
          ))}

          <mesh position={[0, rackHeight / 2 - 0.05, 0]} {...bind}>
            <boxGeometry args={[rack.width + 0.2, 0.1, rack.depth + 0.2]} />
            <meshStandardMaterial {...metal(hovered, isSelected)} />
            <Edges color={hovered ? '#2C5282' : '#1a252f'} lineWidth={2} />
          </mesh>

          <mesh position={[0, -rackHeight / 2 + 0.1, 0]} {...bind}>
            <boxGeometry args={[rack.width + 0.2, 0.2, rack.depth + 0.2]} />
            <meshStandardMaterial {...metal(hovered, isSelected)} />
            <Edges color={hovered ? '#2C5282' : '#1a252f'} lineWidth={2} />
          </mesh>
        </>
      )}

      {!hasContent && (
        <group>
          <mesh position={[0, -rackHeight / 2 + 0.04, 0]} {...bind}>
            <boxGeometry args={[rack.width, 0.08, rack.depth]} />
            <meshStandardMaterial {...metal(hovered, isSelected)} />
            <Edges color={hovered ? '#2C5282' : '#5d6d7e'} lineWidth={2} />
          </mesh>
        </group>
      )}

      {!isDoubleSided && rack.sides.length === 1 && hasContent && (
        <mesh position={[rack.width / 2, 0, 0]} {...bind}>
          <boxGeometry args={[0.1, rackHeight, rack.depth]} />
          <meshStandardMaterial {...metal(hovered, isSelected)} />
          <Edges color={hovered ? '#2C5282' : '#1a252f'} lineWidth={2} />
        </mesh>
      )}

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={isDoubleSided} />
    </>
  )
}
