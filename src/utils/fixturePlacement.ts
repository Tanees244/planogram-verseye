import type { PendingRackParams, Rack } from '@/store/planogramStore'
import { FIXTURE_LIBRARY, resolveFixtureType, type FixtureType } from '@/components/fixtures/types'

interface PlacementState {
  area: { racks: Rack[] }
  selectedStoreId: string | null
}

export function buildPendingRackFromFixture(
  fixtureType: FixtureType,
  state: PlacementState,
): PendingRackParams {
  const def = FIXTURE_LIBRARY[fixtureType]
  const count =
    state.area.racks.filter((r) => resolveFixtureType(r) === fixtureType).length + 1
  const codePrefix = def.label.replace(/\s+/g, '-').replace(/\//g, '').toUpperCase()

  return {
    width: def.defaultWidth,
    depth: def.defaultDepth,
    plankType: 'standard',
    sided: def.defaultSided,
    fixtureType,
    rackCode: `${codePrefix}-${String(count).padStart(2, '0')}`,
    globalLocationId: state.selectedStoreId ?? undefined,
  }
}
