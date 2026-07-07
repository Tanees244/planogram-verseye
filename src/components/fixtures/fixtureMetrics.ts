import type { Rack } from '@/store/planogramStore'
import { FIXTURE_LIBRARY, resolveFixtureType } from './types'
import { computeCustomRackDimensions } from './customRackTypes'

export interface FixtureMetrics {
  rackHeight: number
  rackCenterY: number
  hasContent: boolean
  groupY: number
  isDoubleSided: boolean
}

export function computeFixtureMetrics(rack: Rack): FixtureMetrics {
  const fixtureType = resolveFixtureType(rack)
  const minHeight = FIXTURE_LIBRARY[fixtureType].minHeight

  let rackHeight: number
  if (fixtureType === 'CUSTOM' && rack.customConfig) {
    rackHeight = computeCustomRackDimensions(rack.customConfig).totalHeight
  } else {
    const maxRows = Math.max(...rack.sides.map((s) => s.rows.length), 0)
    const totalRowHeight =
      rack.sides.length > 0
        ? Math.max(
            ...rack.sides.map((side) =>
              side.rows.reduce((sum, r) => sum + r.height, 0),
            ),
          )
        : 0
    const contentHeight = maxRows > 0 ? totalRowHeight + 0.5 : minHeight
    rackHeight = Math.max(contentHeight, minHeight)
  }
  const rackCenterY = rackHeight / 2
  const hasContent = rack.sides.some((side) => side.rows.length > 0)
  // All fixture meshes are center-origin (bottom at -rackHeight/2); lift so base sits on floor.
  const FLOOR_Y = 0.02
  const groupY = rackCenterY + FLOOR_Y
  const isDoubleSided =
    Boolean(rack.isDoubleSided) || rack.sides.length >= 2

  return { rackHeight, rackCenterY, hasContent, groupY, isDoubleSided }
}
