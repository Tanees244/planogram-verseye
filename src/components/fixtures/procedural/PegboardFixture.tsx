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
  const boardZ = rack.depth / 2 - 0.03
  const hookCols = Math.max(4, Math.floor(rack.width / 0.22))
  const hookRows = Math.max(5, Math.floor(rackHeight / 0.28))
  const hookLen = Math.min(0.22, rack.depth * 0.55)

  const hooks: [number, number][] = []
  for (let row = 0; row < hookRows; row++) {
    for (let col = 0; col < hookCols; col++) {
      if ((row + col) % 2 === 0) continue
      const x = -rack.width / 2 + (rack.width / (hookCols + 1)) * (col + 1)
      const y = -rackHeight / 2 + 0.28 + ((rackHeight - 0.45) / (hookRows + 1)) * (row + 1)
      hooks.push([x, y])
    }
  }

  return (
    <>
      {/* Side frames */}
      {[-rack.width / 2 + 0.04, rack.width / 2 - 0.04].map((x, i) => (
        <mesh key={`frame-${i}`} position={[x, 0, 0]} {...bind}>
          <boxGeometry args={[0.07, rackHeight, rack.depth]} />
          <meshStandardMaterial
            color="#7f8c8d"
            metalness={0.55}
            roughness={0.4}
            emissive={emissive}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}

      {/* Top + bottom rails */}
      <mesh position={[0, rackHeight / 2 - 0.04, 0]} {...bind}>
        <boxGeometry args={[rack.width, 0.08, rack.depth]} />
        <meshStandardMaterial color="#95a5a6" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, -rackHeight / 2 + 0.05, 0]} {...bind}>
        <boxGeometry args={[rack.width, 0.1, rack.depth]} />
        <meshStandardMaterial color="#95a5a6" metalness={0.5} roughness={0.45} />
      </mesh>

      {/* Pegboard panel */}
      <mesh position={[0, 0, boardZ]} {...bind}>
        <boxGeometry args={[rack.width * 0.92, rackHeight * 0.9, 0.035]} />
        <meshStandardMaterial
          color="#d5d8dc"
          metalness={0.2}
          roughness={0.85}
          emissive={emissive}
          emissiveIntensity={0.1}
        />
        <Edges color="#95a5a6" threshold={15} lineWidth={1} />
      </mesh>

      {/* Perforation dots */}
      {Array.from({ length: hookRows }).flatMap((_, row) =>
        Array.from({ length: hookCols }).map((_, col) => {
          const x = -rack.width / 2 + (rack.width / (hookCols + 1)) * (col + 1)
          const y = -rackHeight / 2 + 0.28 + ((rackHeight - 0.45) / (hookRows + 1)) * (row + 1)
          return (
            <mesh key={`hole-${row}-${col}`} position={[x, y, boardZ - 0.02]} raycast={() => null}>
              <circleGeometry args={[0.012, 8]} />
              <meshBasicMaterial color="#85929e" />
            </mesh>
          )
        }),
      )}

      {/* Hooks */}
      {hooks.map(([x, y], i) => (
        <group key={`hook-${i}`} position={[x, y, boardZ - hookLen / 2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.01, 0.01, hookLen, 6]} />
            <meshStandardMaterial color="#566573" metalness={0.8} roughness={0.22} />
          </mesh>
          <mesh position={[0, -0.015, -hookLen / 2 + 0.02]} raycast={() => null}>
            <boxGeometry args={[0.035, 0.02, 0.05]} />
            <meshStandardMaterial color="#566573" metalness={0.8} roughness={0.22} />
          </mesh>
        </group>
      ))}

      {/* Base tray */}
      <mesh position={[0, -rackHeight / 2 + 0.08, -rack.depth * 0.05]} {...bind}>
        <boxGeometry args={[rack.width * 0.88, 0.08, rack.depth * 0.7]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.35} roughness={0.55} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
