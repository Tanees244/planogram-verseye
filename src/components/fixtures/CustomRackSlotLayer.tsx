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
  const cavityZ = -d / 2 + wt + innerD / 2

  const side = rack.sides[0]
  if (!side || side.rows.length === 0) return null

  const rows = ensureRowAnchors(side.rows)
  const centers = rowCenterOffsetsFromFloor(rows)

  return (
    <group>
      {rows.map((row, i) => (
        <Row
          key={row.id}
          row={row}
          position={[0, bodyFloorY + centers[i], cavityZ]}
          rackWidth={safeDim(row.width, innerW)}
          rackDepth={innerD * 0.95}
          hideBackWall
        />
      ))}
    </group>
  )
}
