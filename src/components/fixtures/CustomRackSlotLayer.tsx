'use client'

import type { Rack } from '@/store/planogramStore'
import { Row } from '@/components/Row'
import {
  computeCustomRackDimensions,
  type CustomRackConfig,
} from '@/components/fixtures/customRackTypes'
import { safeDim } from '@/utils/safeDimensions'
import { ensureRowAnchors, rowCenterOffsetsFromFloor } from '@/utils/rowStack'

/** Positions planogram rows (shelves) inside a hollow custom rack cavity. */
export function CustomRackSlotLayer({
  rack,
  config,
}: {
  rack: Rack
  config: CustomRackConfig
}) {
  const dims = computeCustomRackDimensions(config)
  const { outerDepth: d, wallThickness: wt } = config
  const bottomY = -dims.totalHeight / 2
  const bodyFloorY = bottomY + dims.footerH + wt * 0.3
  const innerW = dims.innerWidth
  const innerD = dims.innerDepth
  const isDoubleSided =
    Boolean(config.isDoubleSided) || Boolean(rack.isDoubleSided) || rack.sides.length >= 2

  if (rack.sides.length === 0) return null

  // One-sided: cavity sits in front of the back wall.
  // Two-sided: each face gets half the depth around a center divider.
  if (!isDoubleSided) {
    const side = rack.sides[0]
    if (!side || side.rows.length === 0) return null
    const cavityZ = -d / 2 + wt + innerD / 2
    const rows = ensureRowAnchors(side.rows)
    const centers = rowCenterOffsetsFromFloor(rows)
    return (
      <group>
        {rows.map((row, i) => (
          <Row
            key={row.id}
            row={row}
            position={[0, bodyFloorY + centers[i], cavityZ]}
            rackWidth={innerW}
            rackDepth={innerD * 0.95}
            hideBackWall
          />
        ))}
      </group>
    )
  }

  const sideDepth = Math.max(0.08, (innerD - wt) / 2)
  const shelfOffsetZ = -sideDepth / 2

  return (
    <group>
      {rack.sides.map((side, sideIndex) => {
        if (!side || side.rows.length === 0) return null
        const rows = ensureRowAnchors(side.rows)
        const centers = rowCenterOffsetsFromFloor(rows)
        const sideRotationY = sideIndex === 1 ? Math.PI : 0
        return (
          <group key={side.sideId ?? side.id} rotation={[0, sideRotationY, 0]}>
            {rows.map((row, i) => (
              <Row
                key={row.id}
                row={row}
                position={[0, bodyFloorY + centers[i], shelfOffsetZ]}
                rackWidth={innerW}
                rackDepth={sideDepth * 0.95}
                hideBackWall
                openBothSides
              />
            ))}
          </group>
        )
      })}
    </group>
  )
}
