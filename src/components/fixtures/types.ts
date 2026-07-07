import type { Rack } from '@/store/planogramStore'

/** Parametric fixture library (Option 1 — procedural Three.js). */
export type FixtureType =
  | 'GONDOLA'
  | 'WALL_BAY'
  | 'END_CAP'
  | 'DUMP_BIN'
  | 'PALLET_DISPLAY'
  | 'REFRIGERATED'
  | 'FREEZER'
  | 'PEGBOARD'
  | 'CHECKOUT'
  | 'PROMOTIONAL'
  | 'CUSTOM'

export interface FixtureDefinition {
  type: FixtureType
  label: string
  description: string
  defaultWidth: number
  defaultDepth: number
  minHeight: number
  /** Default sided when creating a new fixture. */
  defaultSided: 'one' | 'two'
}

export const FIXTURE_LIBRARY: Record<FixtureType, FixtureDefinition> = {
  GONDOLA: {
    type: 'GONDOLA',
    label: 'Gondola',
    description: 'Single or double-sided aisle shelving with adjustable rows and bins.',
    defaultWidth: 2.5,
    defaultDepth: 1.2,
    minHeight: 2,
    defaultSided: 'two',
  },
  WALL_BAY: {
    type: 'WALL_BAY',
    label: 'Wall Bay',
    description: 'Tall wall-mounted shelving — back panel with open front-facing shelves.',
    defaultWidth: 3,
    defaultDepth: 0.5,
    minHeight: 2.5,
    defaultSided: 'one',
  },
  END_CAP: {
    type: 'END_CAP',
    label: 'End Cap',
    description: 'High-visibility end-of-aisle promotional display.',
    defaultWidth: 1.2,
    defaultDepth: 0.8,
    minHeight: 1.8,
    defaultSided: 'one',
  },
  DUMP_BIN: {
    type: 'DUMP_BIN',
    label: 'Dump Bin',
    description: 'Bulk promotional bin for seasonal or discounted products.',
    defaultWidth: 1.5,
    defaultDepth: 1,
    minHeight: 1,
    defaultSided: 'one',
  },
  PALLET_DISPLAY: {
    type: 'PALLET_DISPLAY',
    label: 'Pallet Display',
    description: 'Low warehouse-style pallet for bulk beverages and heavy goods.',
    defaultWidth: 1.2,
    defaultDepth: 1,
    minHeight: 0.5,
    defaultSided: 'one',
  },
  REFRIGERATED: {
    type: 'REFRIGERATED',
    label: 'Refrigerated Cabinet',
    description: 'Glass-door chilled cabinet for dairy, juice and chilled foods.',
    defaultWidth: 1.8,
    defaultDepth: 0.7,
    minHeight: 2,
    defaultSided: 'one',
  },
  FREEZER: {
    type: 'FREEZER',
    label: 'Freezer Cabinet',
    description: 'Insulated upright freezer for frozen products.',
    defaultWidth: 1.5,
    defaultDepth: 0.75,
    minHeight: 2.2,
    defaultSided: 'one',
  },
  PEGBOARD: {
    type: 'PEGBOARD',
    label: 'Pegboard / Hook Display',
    description: 'Perforated board with hooks for hanging accessories and small packs.',
    defaultWidth: 1.2,
    defaultDepth: 0.4,
    minHeight: 1.8,
    defaultSided: 'one',
  },
  CHECKOUT: {
    type: 'CHECKOUT',
    label: 'Checkout Rack',
    description: 'Low impulse tiers beside the point-of-sale counter.',
    defaultWidth: 1,
    defaultDepth: 0.35,
    minHeight: 1.2,
    defaultSided: 'one',
  },
  PROMOTIONAL: {
    type: 'PROMOTIONAL',
    label: 'Promotional Display',
    description: 'Temporary campaign island with bold header and open tiers.',
    defaultWidth: 1.5,
    defaultDepth: 1,
    minHeight: 1.6,
    defaultSided: 'one',
  },
  CUSTOM: {
    type: 'CUSTOM',
    label: 'Custom Rack',
    description: 'Build your own — header, footer, walls, inner/outer dimensions.',
    defaultWidth: 1.5,
    defaultDepth: 0.8,
    minHeight: 1.5,
    defaultSided: 'one',
  },
}

export const FIXTURE_TYPES = Object.keys(FIXTURE_LIBRARY) as FixtureType[]

export function resolveFixtureType(rack: Rack): FixtureType {
  const t = rack.fixtureType
  if (t && t in FIXTURE_LIBRARY) return t
  return 'GONDOLA'
}

export interface FixtureShellProps {
  rack: Rack
  rackHeight: number
  hasContent: boolean
  hovered: boolean
  isSelected: boolean
  onSelect: (e: unknown) => void
  onPointerOver: (e: unknown) => void
  onPointerOut: () => void
}
