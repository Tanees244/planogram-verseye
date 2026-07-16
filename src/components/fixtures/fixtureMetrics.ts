import type { Rack } from '@/store/planogramStore'
import { FIXTURE_LIBRARY, resolveFixtureType } from './types'
import { computeCustomRackDimensions } from './customRackTypes'
import { safeDim } from '@/utils/safeDimensions'

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
  const outerH =
    rack.outer?.height != null && Number(rack.outer.height) > 0
      ? Number(rack.outer.height)
      : rack.height != null && Number(rack.height) > 0
        ? Number(rack.height)
        : FIXTURE_LIBRARY[fixtureType].defaultHeight

  let rackHeight: number
  if (fixtureType === 'CUSTOM' && rack.customConfig) {
    rackHeight = safeDim(computeCustomRackDimensions(rack.customConfig).totalHeight, minHeight, minHeight)
  } else {
    const maxRows = Math.max(...rack.sides.map((s) => s.rows.length), 0)
    const totalRowHeight =
      rack.sides.length > 0
        ? Math.max(
            ...rack.sides.map((side) =>
              side.rows.reduce((sum, r) => sum + safeDim(r.height, 1.5), 0),
            ),
            0,
          )
        : 0
    const contentHeight = maxRows > 0 ? totalRowHeight + 0.5 : outerH
    rackHeight = Math.max(contentHeight, minHeight, outerH)
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
