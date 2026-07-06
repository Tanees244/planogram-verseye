// @ts-nocheck
'use client'

import { Edges } from '@react-three/drei'
import type { FixtureShellProps } from '../types'
import { FixtureSlotLayer } from '../FixtureSlotLayer'

/** Bulk dump bin — tapered open-top container for promos. */
export function DumpBinFixture({
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
  const wallT = 0.06
  const lipH = 0.08
  const innerW = rack.width - wallT * 2
  const innerD = rack.depth - wallT * 2
  const taper = 0.12

  const wallProps = {
    color: '#f39c12',
    metalness: 0.25,
    roughness: 0.65,
    emissive: hovered ? '#e67e22' : emissive,
    emissiveIntensity: hovered ? 0.25 : 0.08,
  }

  return (
    <>
      {/* Floor of bin */}
      <mesh position={[0, -rackHeight / 2 + wallT / 2, 0]} {...bind}>
        <boxGeometry args={[rack.width, wallT, rack.depth]} />
        <meshStandardMaterial {...wallProps} />
      </mesh>

      {/* Four tapered walls — wider at top */}
      <mesh position={[0, 0, -rack.depth / 2 + wallT / 2]} {...bind}>
        <boxGeometry args={[rack.width + taper, rackHeight - lipH, wallT]} />
        <meshStandardMaterial {...wallProps} />
        <Edges color="#d35400" lineWidth={1.5} />
      </mesh>
      <mesh position={[0, 0, rack.depth / 2 - wallT / 2]} {...bind}>
        <boxGeometry args={[rack.width + taper * 0.5, rackHeight - lipH, wallT]} />
        <meshStandardMaterial {...wallProps} />
        <Edges color="#d35400" lineWidth={1.5} />
      </mesh>
      <mesh position={[-rack.width / 2 + wallT / 2, 0, 0]} {...bind}>
        <boxGeometry args={[wallT, rackHeight - lipH, rack.depth]} />
        <meshStandardMaterial {...wallProps} />
      </mesh>
      <mesh position={[rack.width / 2 - wallT / 2, 0, 0]} {...bind}>
        <boxGeometry args={[wallT, rackHeight - lipH, rack.depth]} />
        <meshStandardMaterial {...wallProps} />
      </mesh>

      {/* Rolled lip */}
      <mesh position={[0, rackHeight / 2 - lipH / 2, 0]} {...bind}>
        <boxGeometry args={[rack.width + taper * 1.5, lipH, rack.depth + taper]} />
        <meshStandardMaterial color="#e67e22" metalness={0.45} roughness={0.4} emissive={emissive} emissiveIntensity={0.15} />
      </mesh>

      {/* Inner floor tint */}
      <mesh position={[0, -rackHeight / 2 + wallT + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[innerW, innerD]} />
        <meshStandardMaterial color="#fdebd0" roughness={0.9} />
      </mesh>

      <FixtureSlotLayer rack={rack} rackHeight={rackHeight} isDoubleSided={false} />
    </>
  )
}
