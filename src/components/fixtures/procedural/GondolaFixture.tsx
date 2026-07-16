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

/** Standard aisle gondola — single or double-sided; full frame even when empty. */
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
  const post = 0.08
  const halfW = rack.width / 2
  const halfD = rack.depth / 2

  return (
    <>
      {/* Corner posts */}
      {[
        [-halfW + post / 2, -halfD + post / 2],
        [halfW - post / 2, -halfD + post / 2],
        [-halfW + post / 2, halfD - post / 2],
        [halfW - post / 2, halfD - post / 2],
      ].map(([x, z], i) => (
        <mesh key={`post-${i}`} position={[x, 0, z]} {...bind}>
          <boxGeometry args={[post, rackHeight, post]} />
          <meshStandardMaterial {...metal(hovered, isSelected)} />
        </mesh>
      ))}

      {/* Top rail */}
      <mesh position={[0, rackHeight / 2 - 0.04, 0]} {...bind}>
        <boxGeometry args={[rack.width, 0.08, rack.depth]} />
        <meshStandardMaterial {...metal(hovered, isSelected)} />
        <Edges color={hovered ? '#2C5282' : '#1a252f'} lineWidth={2} />
      </mesh>

      {/* Kick plate / base */}
      <mesh position={[0, -rackHeight / 2 + 0.08, 0]} {...bind}>
        <boxGeometry args={[rack.width, 0.16, rack.depth]} />
        <meshStandardMaterial {...metal(hovered, isSelected)} />
        <Edges color={hovered ? '#2C5282' : '#1a252f'} lineWidth={2} />
      </mesh>

      {/* Center divider for double-sided / back panel for single */}
      {isDoubleSided ? (
        <mesh position={[0, 0, 0]} {...bind}>
          <boxGeometry args={[rack.width * 0.98, rackHeight * 0.92, 0.04]} />
          <meshStandardMaterial color="#ecf0f1" metalness={0.2} roughness={0.7} />
        </mesh>
      ) : (
        <mesh position={[0, 0, halfD - 0.03]} {...bind}>
          <boxGeometry args={[rack.width * 0.98, rackHeight * 0.92, 0.05]} />
          <meshStandardMaterial color="#ecf0f1" metalness={0.2} roughness={0.7} />
        </mesh>
      )}

      {/* Empty placeholder shelves so bay looks real before rows are added */}
      {!hasContent &&
        [0.25, 0.5, 0.75].map((t, i) => {
          const y = -rackHeight / 2 + rackHeight * t
          return (
            <mesh key={`shelf-${i}`} position={[0, y, 0]} raycast={() => null}>
              <boxGeometry
                args={[
                  rack.width * 0.92,
                  0.03,
                  isDoubleSided ? rack.depth * 0.92 : rack.depth * 0.85,
                ]}
              />
              <meshStandardMaterial color="#f4f6f7" metalness={0.15} roughness={0.75} />
            </mesh>
          )
        })}

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={isDoubleSided} />
    </>
  )
}
