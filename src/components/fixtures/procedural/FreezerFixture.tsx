// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Upright freezer — open front so shelves / SKUs stay visible. */
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
  const wallT = 0.08
  const halfW = rack.width / 2
  const halfD = rack.depth / 2
  const halfH = rackHeight / 2
  const innerW = rack.width - wallT * 2
  const innerD = rack.depth - wallT

  return (
    <>
      {/* Back wall */}
      <mesh position={[0, 0, halfD - wallT / 2]} {...bind}>
        <boxGeometry args={[rack.width, rackHeight, wallT]} />
        <meshStandardMaterial
          color="#e8f4fc"
          metalness={0.15}
          roughness={0.7}
          emissive={emissive}
          emissiveIntensity={0.1}
        />
        <Edges color="#aab7b8" lineWidth={1.5} />
      </mesh>

      {/* Left / right walls */}
      {([-1, 1] as const).map((side) => (
        <mesh key={`side-${side}`} position={[side * (halfW - wallT / 2), 0, wallT / 2]} {...bind}>
          <boxGeometry args={[wallT, rackHeight, rack.depth - wallT]} />
          <meshStandardMaterial
            color="#f4f6f7"
            metalness={0.25}
            roughness={0.55}
            emissive={emissive}
            emissiveIntensity={0.08}
          />
        </mesh>
      ))}

      {/* Top fascia (no front door) */}
      <mesh position={[0, halfH - 0.05, 0]} {...bind}>
        <boxGeometry args={[rack.width, 0.1, rack.depth]} />
        <meshStandardMaterial color="#d5dbdb" metalness={0.45} roughness={0.45} />
      </mesh>

      {/* Floor / kick */}
      <mesh position={[0, -halfH + 0.05, wallT / 2]} {...bind}>
        <boxGeometry args={[innerW, 0.1, innerD]} />
        <meshStandardMaterial color="#dce6ef" metalness={0.2} roughness={0.65} />
      </mesh>

      {/* Inner cold tint (open front — does not block view) */}
      <mesh position={[0, 0, wallT * 0.5]} raycast={() => null}>
        <boxGeometry args={[innerW * 0.98, rackHeight * 0.88, innerD * 0.92]} />
        <meshStandardMaterial
          color="#ebf5fb"
          transparent
          opacity={0.18}
          depthWrite={false}
          emissive="#d6eaf8"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Temp badge on top-right of frame */}
      <mesh position={[halfW - 0.2, halfH - 0.2, -halfD + 0.02]}>
        <boxGeometry args={[0.24, 0.1, 0.02]} />
        <meshStandardMaterial color="#1b2631" emissive="#2C5282" emissiveIntensity={0.45} />
      </mesh>

      {/* Empty shelves when no rows yet */}
      {!hasContent &&
        [0.28, 0.5, 0.72].map((t, i) => (
          <mesh
            key={`shelf-${i}`}
            position={[0, -halfH + rackHeight * t, wallT * 0.3]}
            raycast={() => null}
          >
            <boxGeometry args={[innerW * 0.92, 0.025, innerD * 0.9]} />
            <meshStandardMaterial color="#aed6f1" transparent opacity={0.55} roughness={0.25} />
          </mesh>
        ))}

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
