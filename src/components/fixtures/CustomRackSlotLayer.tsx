'use client'

import type { Rack } from '@/store/planogramStore'
import { Row } from '@/components/Row'
import {
  computeCustomRackDimensions,
  type CustomRackConfig,
} from '@/components/fixtures/customRackTypes'

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

  let stackY = bodyFloorY
  const placements: { y: number; row: (typeof side.rows)[0] }[] = []
  side.rows.forEach((row) => {
    placements.push({ y: stackY + row.height / 2, row })
    stackY += row.height
  })

  return (
    <group>
      {placements.map(({ y, row }) => (
        <Row
          key={row.id}
          row={row}
          position={[0, y, cavityZ]}
          rackWidth={row.width ?? innerW}
          rackDepth={innerD * 0.95}
          hideBackWall
        />
      ))}
    </group>
  )
}
