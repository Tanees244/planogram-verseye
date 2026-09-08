// @ts-nocheck
'use client'

import type { Rack } from '@/store/planogramStore'
import { Row } from '@/components/Row'
import { ensureRowAnchors, rowCenterOffsetsFromFloor } from '@/utils/rowStack'
import { useRackDetailVisible } from '@/components/scene/SpatialVisibility'

interface FixtureSlotLayerProps {
  rack: Rack
  rackHeight: number
  isDoubleSided: boolean
}

/** Shared row → bin → product slot graph for all fixture types. */
export function FixtureSlotLayer({ rack, rackHeight, isDoubleSided }: FixtureSlotLayerProps) {
  const detailVisible = useRackDetailVisible(rack.id)
  // Spatial grid + frustum: skip SKU trees for far / off-screen racks.
  if (!detailVisible) return null

  const sideOffset = rack.sides.length === 2 ? rack.width / 4 : 0
  const baseTopY = -rackHeight / 2 + 0.2
  const innerW = rack.inner?.width && rack.inner.width > 0 ? rack.inner.width : null
  const innerD = rack.inner?.depth && rack.inner.depth > 0 ? rack.inner.depth : null

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
        // Prefer API inner / row span so bins don't overflow a heuristic 0.85× outer width after reflow.
        const sideUsableW =
          (typeof side.inner?.width === 'number' && side.inner.width > 0 && side.inner.width) ||
          (typeof side.dimensions?.usableWidth === 'number' &&
            side.dimensions.usableWidth > 0 &&
            side.dimensions.usableWidth) ||
          null
        const rowWidth = isDoubleSided
          ? (innerW ?? rack.width) * 0.95
          : (sideUsableW ?? innerW ?? (rack.width / numSides) * 0.85)
        const rowDepth = isDoubleSided
          ? (innerD ?? rack.depth) * 0.5
          : (innerD ?? rack.depth * 0.9)
        const shelfOffsetZ = isDoubleSided ? -rowDepth / 2 : 0

        const rows = ensureRowAnchors(side.rows)
        const centers = rowCenterOffsetsFromFloor(rows)
        const rowPositions = centers.map((c) => baseTopY + c)

        return (
          <group
            key={side.sideId}
            position={[sideX, 0, 0]}
            rotation={[0, sideRotationY, 0]}
          >
            {rows.map((row, rowIndex) => {
              const spanW =
                (typeof row.span === 'number' && row.span > 0 && row.span) ||
                (typeof row.width === 'number' && row.width > 0 && row.width) ||
                rowWidth
              return (
                <Row
                  key={row.id}
                  row={row}
                  position={[0, rowPositions[rowIndex], 0]}
                  rackWidth={spanW}
                  rackDepth={rowDepth}
                  showBottomBorder={rowIndex < rows.length - 1}
                  openBothSides={isDoubleSided}
                  shelfOffsetZ={shelfOffsetZ}
                />
              )
            })}
          </group>
        )
      })}
    </>
  )
}

