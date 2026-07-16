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
  /** Outer / shell height sent to backend on create (meters). */
  defaultHeight: number
  minHeight: number
  /** Default sided when creating a new fixture. */
  defaultSided: 'one' | 'two'
}

export const FIXTURE_LIBRARY: Record<FixtureType, FixtureDefinition> = {
  GONDOLA: {
    type: 'GONDOLA',
    label: 'Gondola',
    description: 'Double-sided aisle shelving bay — standard grocery / dairy run.',
    // Matches backend STORE_LAYOUT_STRUCTURE GONDOLA-01 sketch
    defaultWidth: 2.7,
    defaultDepth: 1.1,
    defaultHeight: 2.0,
    minHeight: 2.0,
    defaultSided: 'two',
  },
  WALL_BAY: {
    type: 'WALL_BAY',
    label: 'Wall Bay',
    description: 'Tall wall-mounted shelving — back panel with open front-facing shelves.',
    defaultWidth: 2.7,
    defaultDepth: 0.55,
    defaultHeight: 2.2,
    minHeight: 2.2,
    defaultSided: 'one',
  },
  END_CAP: {
    type: 'END_CAP',
    label: 'End Cap',
    description: 'High-visibility end-of-aisle promotional display.',
    defaultWidth: 0.9,
    defaultDepth: 0.5,
    defaultHeight: 1.8,
    minHeight: 1.8,
    defaultSided: 'one',
  },
  DUMP_BIN: {
    type: 'DUMP_BIN',
    label: 'Dump Bin',
    description: 'Bulk promotional bin for seasonal or discounted products.',
    defaultWidth: 1.5,
    defaultDepth: 1,
    defaultHeight: 1.0,
    minHeight: 1.0,
    defaultSided: 'one',
  },
  PALLET_DISPLAY: {
    type: 'PALLET_DISPLAY',
    label: 'Pallet Display',
    description: 'Low warehouse-style pallet for bulk beverages and heavy goods.',
    defaultWidth: 1.2,
    defaultDepth: 0.8,
    defaultHeight: 0.5,
    minHeight: 0.5,
    defaultSided: 'one',
  },
  REFRIGERATED: {
    type: 'REFRIGERATED',
    label: 'Refrigerated Cabinet',
    description: 'Glass-door chilled cabinet for dairy, juice and chilled foods.',
    defaultWidth: 1.8,
    defaultDepth: 0.72,
    defaultHeight: 2.2,
    minHeight: 2.0,
    defaultSided: 'one',
  },
  FREEZER: {
    type: 'FREEZER',
    label: 'Freezer Cabinet',
    description: 'Upright insulated freezer — frozen foods / ice cream bay.',
    // Typical multi-door upright: ~1.8 m wide × 0.8 m deep × 2.2 m tall
    defaultWidth: 1.8,
    defaultDepth: 0.8,
    defaultHeight: 2.2,
    minHeight: 2.2,
    defaultSided: 'one',
  },
  PEGBOARD: {
    type: 'PEGBOARD',
    label: 'Pegboard / Hook Display',
    description: 'Wall pegboard with hooks for hanging packs and accessories.',
    // Slim wall fixture — shallow depth for hooks
    defaultWidth: 1.2,
    defaultDepth: 0.45,
    defaultHeight: 2.0,
    minHeight: 1.8,
    defaultSided: 'one',
  },
  CHECKOUT: {
    type: 'CHECKOUT',
    label: 'Checkout Rack',
    description: 'Low impulse tiers beside the point-of-sale counter.',
    defaultWidth: 1,
    defaultDepth: 0.35,
    defaultHeight: 1.2,
    minHeight: 1.2,
    defaultSided: 'one',
  },
  PROMOTIONAL: {
    type: 'PROMOTIONAL',
    label: 'Promotional Display',
    description: 'Temporary campaign island with bold header and open tiers.',
    defaultWidth: 1.5,
    defaultDepth: 1,
    defaultHeight: 1.6,
    minHeight: 1.6,
    defaultSided: 'one',
  },
  CUSTOM: {
    type: 'CUSTOM',
    label: 'Custom Rack',
    description: 'Build your own — header, footer, walls, inner/outer dimensions.',
    defaultWidth: 2.7,
    defaultDepth: 1.1,
    defaultHeight: 2.0,
    minHeight: 2,
    defaultSided: 'one',
  },
}

/** Presets shown in Fixture Library (backend-supported placement types). */
export const FIXTURE_PRESET_TYPES: FixtureType[] = ['GONDOLA', 'FREEZER', 'PEGBOARD']

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
