import type { FixtureType } from '@/components/fixtures/types'
import { FIXTURE_LIBRARY } from '@/components/fixtures/types'

export interface FixtureSeedRow {
  height: number
  bins: number
  /** Optional label prefix for bins (Bin 1, Bin 2…). */
  binLabel?: string
}

export interface FixtureSeedLayout {
  rows: FixtureSeedRow[]
}

/**
 * Default shelf layout created on the backend after placing a preset fixture.
 * Heights must fit within fixture defaultHeight (usable stack).
 */
export function getFixtureSeedLayout(fixtureType: FixtureType): FixtureSeedLayout | null {
  switch (fixtureType) {
    case 'GONDOLA':
      // 2.0 m tall · 4 shelves · 3 bins across bay
      return {
        rows: [
          { height: 0.45, bins: 3, binLabel: 'Bay' },
          { height: 0.45, bins: 3, binLabel: 'Bay' },
          { height: 0.45, bins: 3, binLabel: 'Bay' },
          { height: 0.45, bins: 3, binLabel: 'Bay' },
        ],
      }
    case 'FREEZER':
      // 2.2 m tall · 4 cold shelves · 2 bins
      return {
        rows: [
          { height: 0.5, bins: 2, binLabel: 'Freeze' },
          { height: 0.5, bins: 2, binLabel: 'Freeze' },
          { height: 0.5, bins: 2, binLabel: 'Freeze' },
          { height: 0.5, bins: 2, binLabel: 'Freeze' },
        ],
      }
    case 'PEGBOARD':
      // 2.0 m tall · 5 hook levels · 4 hanging slots
      return {
        rows: [
          { height: 0.35, bins: 4, binLabel: 'Hook' },
          { height: 0.35, bins: 4, binLabel: 'Hook' },
          { height: 0.35, bins: 4, binLabel: 'Hook' },
          { height: 0.35, bins: 4, binLabel: 'Hook' },
          { height: 0.35, bins: 4, binLabel: 'Hook' },
        ],
      }
    default:
      return null
  }
}

export function fixtureSeedFits(fixtureType: FixtureType): boolean {
  const layout = getFixtureSeedLayout(fixtureType)
  if (!layout) return false
  const usable = FIXTURE_LIBRARY[fixtureType].defaultHeight
  const stack = layout.rows.reduce((s, r) => s + r.height, 0)
  return stack <= usable + 0.001
}
