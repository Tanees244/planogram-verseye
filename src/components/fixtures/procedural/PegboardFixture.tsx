// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Pegboard with hook grid for hanging packaged goods. */
export function PegboardFixture({
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
  const boardZ = rack.depth / 2 - 0.04
  const hookCols = Math.max(3, Math.floor(rack.width / 0.25))
  const hookRows = Math.max(4, Math.floor(rackHeight / 0.35))
  const hookLen = rack.depth * 0.55

  const hooks: [number, number][] = []
  for (let row = 0; row < hookRows; row++) {
    for (let col = 0; col < hookCols; col++) {
      if ((row + col) % 2 === 0) continue
      const x = -rack.width / 2 + (rack.width / (hookCols + 1)) * (col + 1)
      const y = -rackHeight / 2 + 0.25 + (rackHeight / (hookRows + 1)) * (row + 1)
      hooks.push([x, y])
    }
  }

  return (
    <>
      {/* Side frames */}
      {[-rack.width / 2 + 0.05, rack.width / 2 - 0.05].map((x, i) => (
        <mesh key={`frame-${i}`} position={[x, 0, 0]} {...bind}>
          <boxGeometry args={[0.08, rackHeight, rack.depth]} />
          <meshStandardMaterial color="#7f8c8d" metalness={0.5} roughness={0.45} emissive={emissive} emissiveIntensity={0.15} />
        </mesh>
      ))}

      {/* Pegboard panel (perforated look via edges) */}
      <mesh position={[0, 0, boardZ]} {...bind}>
        <boxGeometry args={[rack.width * 0.9, rackHeight * 0.92, 0.04]} />
        <meshStandardMaterial color="#d5d8dc" metalness={0.2} roughness={0.85} emissive={emissive} emissiveIntensity={0.1} />
        <Edges color="#95a5a6" threshold={15} lineWidth={1} />
      </mesh>

      {/* Hooks */}
      {hooks.map(([x, y], i) => (
        <group key={`hook-${i}`} position={[x, y, boardZ - hookLen / 2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.012, 0.012, hookLen, 6]} />
            <meshStandardMaterial color="#566573" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, -hookLen / 2 + 0.02]} raycast={() => null}>
            <boxGeometry args={[0.04, 0.02, 0.06]} />
            <meshStandardMaterial color="#566573" metalness={0.75} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* Base tray */}
      <mesh position={[0, -rackHeight / 2 + 0.06, rack.depth * 0.15]} {...bind}>
        <boxGeometry args={[rack.width * 0.85, 0.1, rack.depth * 0.5]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.35} roughness={0.55} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
