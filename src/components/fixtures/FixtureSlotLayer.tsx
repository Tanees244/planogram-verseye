// @ts-nocheck
'use client'

import type { Rack } from '@/store/planogramStore'
import { Row } from '@/components/Row'

interface FixtureSlotLayerProps {
  rack: Rack
  rackHeight: number
  isDoubleSided: boolean
}

/** Shared row → bin → product slot graph for all fixture types. */
export function FixtureSlotLayer({ rack, rackHeight, isDoubleSided }: FixtureSlotLayerProps) {
  const sideOffset = rack.sides.length === 2 ? rack.width / 4 : 0
  const baseTopY = -rackHeight / 2 + 0.2

  return (
    <>
      {rack.sides.map((side, sideIndex) => {
        const sideX = isDoubleSided
          ? 0
          : rack.sides.length === 2
            ? sideIndex === 0
              ? -sideOffset
              : sideOffset
            : 0
        const sideRotationY = isDoubleSided && sideIndex === 1 ? Math.PI : 0
        const numSides = rack.sides.length
        const rowWidth = isDoubleSided
          ? rack.width * 0.9
          : (rack.width / numSides) * 0.85
        const rowDepth = isDoubleSided ? rack.depth * 0.5 : rack.depth * 0.9
        const shelfOffsetZ = isDoubleSided ? -rowDepth / 2 : 0

        let currentY = baseTopY
        const rowPositions: number[] = []
        side.rows.forEach((row) => {
          rowPositions.push(currentY + row.height / 2)
          currentY += row.height
        })

        return (
          <group
            key={side.sideId}
            position={[sideX, 0, 0]}
            rotation={[0, sideRotationY, 0]}
          >
            {side.rows.map((row, rowIndex) => (
              <Row
                key={row.id}
                row={row}
                position={[0, rowPositions[rowIndex], 0]}
                rackWidth={rowWidth}
                rackDepth={rowDepth}
                showBottomBorder={rowIndex < side.rows.length - 1}
                openBothSides={isDoubleSided}
                shelfOffsetZ={shelfOffsetZ}
              />
            ))}
          </group>
        )
      })}
    </>
  )
}
