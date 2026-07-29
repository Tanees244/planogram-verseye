import type { Bin, Product, Rack, Row } from '@/store/planogramStore'
import { FIXTURE_LIBRARY } from '@/components/fixtures/types'
import { getRotatedFootprintHalf, rackOverlapsOthers } from '@/utils/rackPlacement'

const WALL_MARGIN = 0.12

/** Sample facing colors so guide racks look stocked like a real planogram. */
const SAMPLE_COLORS = [
  '#2C5282',
  '#E53E3E',
  '#38A169',
  '#D69E2E',
  '#805AD5',
  '#DD6B20',
  '#319795',
  '#B83280',
]

export interface WallGuideSlot {
  key: string
  x: number
  z: number
  rotationY: number
}

function makeId(prefix: string, key: string, n: number): string {
  return `guide-${prefix}-${key}-${n}`
}

function sampleProducts(binKey: string, facingW: number): Product[] {
  const colors = [
    SAMPLE_COLORS[Math.abs(hash(binKey)) % SAMPLE_COLORS.length],
    SAMPLE_COLORS[Math.abs(hash(binKey) + 3) % SAMPLE_COLORS.length],
  ]
  const unitW = 0.08
  const facings = Math.max(2, Math.min(8, Math.floor(facingW / unitW) - 1))
  return colors.map((color, i) => ({
    id: makeId('sku', binKey, i),
    name: i === 0 ? 'Guide SKU A' : 'Guide SKU B',
    color,
    width: unitW,
    height: 0.18 + (i % 2) * 0.06,
    depth: 0.08,
    quantity: Math.max(2, Math.floor(facings / colors.length)),
  }))
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/**
 * Build a one-sided WALL_BAY rack with shelves, bins, and sample products —
 * same shape as a real placed fixture, used only as a non-interactive wall guide.
 */
export function buildWallGuideRack(slot: WallGuideSlot): Rack {
  const def = FIXTURE_LIBRARY.WALL_BAY
  const width = def.defaultWidth
  const depth = def.defaultDepth
  const height = def.defaultHeight
  const wallT = 0.06
  const innerW = Math.max(0.2, width - wallT * 2)
  const innerD = Math.max(0.15, depth - wallT)
  const rowH = 0.4
  const rowCount = 4
  const binsPerRow = 3
  const binW = innerW / binsPerRow

  const rows: Row[] = Array.from({ length: rowCount }, (_, ri) => {
    const rowId = makeId('row', slot.key, ri)
    const bins: Bin[] = Array.from({ length: binsPerRow }, (_, bi) => {
      const binId = makeId('bin', slot.key, ri * 10 + bi)
      return {
        id: binId,
        binName: `Bay ${bi + 1}`,
        width: binW - 0.01,
        depth: innerD * 0.92,
        height: rowH - 0.05,
        products: sampleProducts(binId, binW),
      }
    })
    return {
      id: rowId,
      height: rowH,
      width: innerW,
      span: innerW,
      depth: innerD,
      sided: 'one',
      yStart: ri * rowH,
      yEnd: (ri + 1) * rowH,
      bins,
    }
  })

  const quadrant =
    slot.x < 0 && slot.z >= 0
      ? 'NW'
      : slot.x >= 0 && slot.z >= 0
        ? 'NE'
        : slot.x < 0
          ? 'SW'
          : 'SE'

  return {
    id: makeId('rack', slot.key, 0),
    rackId: makeId('rack', slot.key, 0),
    rackCode: `GUIDE-${slot.key.toUpperCase()}`,
    rackName: 'Wall guide',
    blueprintName: 'Wall Bay (guide)',
    displayName: 'Wall Bay guide',
    width,
    depth,
    height: String(height),
    fixtureType: 'WALL_BAY',
    isDoubleSided: false,
    position: { x: slot.x, y: 0, z: slot.z },
    rotation: { x: 0, y: slot.rotationY, z: 0 },
    quadrant,
    placement: {
      position: { x: slot.x, y: 0, z: slot.z },
      rotation: { x: 0, y: slot.rotationY, z: 0 },
      snapMode: 'wall',
      quadrant,
    },
    outer: { width, depth, height },
    inner: { width: innerW, depth: innerD, height: rowH * rowCount },
    shell: {
      wallThickness: wallT,
      walls: { back: true, left: true, right: true, frontGlass: false },
      header: {
        enabled: true,
        width,
        depth,
        height: 0.22,
        protrusion: 0,
        color: '#2C5282',
        emissive: '#1A365D',
      },
      footer: {
        enabled: true,
        width,
        depth,
        height: 0.1,
        protrusion: 0,
        color: '#ecf0f1',
        emissive: null,
      },
      frame: { cornerPosts: 4, topRail: true, innerFloor: true },
      materials: {
        accentColor: '#2C5282',
        wallColor: '#e8eaed',
        postColor: '#1a1a1a',
      },
    },
    sides: [
      {
        id: makeId('side', slot.key, 0),
        sideId: makeId('side', slot.key, 0),
        sideCode: 'S1',
        depth,
        inner: { width: innerW, depth: innerD },
        outer: { width, depth },
        rows,
      },
    ],
  }
}

/** Tile one-sided wall-bay slots along every floor wall (skip real-rack overlaps). */
export function computeWallGuideSlots(
  areaWidth: number,
  areaDepth: number,
  racks: Array<{
    id: string
    position: { x: number; z: number }
    width: number
    depth: number
    rotation?: { y?: number } | null
  }>,
): WallGuideSlot[] {
  if (!(areaWidth > 0) || !(areaDepth > 0)) return []

  const width = FIXTURE_LIBRARY.WALL_BAY.defaultWidth
  const depth = FIXTURE_LIBRARY.WALL_BAY.defaultDepth
  const halfW = areaWidth / 2
  const halfD = areaDepth / 2
  const out: WallGuideSlot[] = []

  const walls = [
    { id: 'back', rotationY: Math.PI, axis: 'x' as const },
    { id: 'front', rotationY: 0, axis: 'x' as const },
    { id: 'left', rotationY: -Math.PI / 2, axis: 'z' as const },
    { id: 'right', rotationY: Math.PI / 2, axis: 'z' as const },
  ]

  for (const wall of walls) {
    const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(width, depth, wall.rotationY)
    const alongHalf = wall.axis === 'x' ? hw : hd
    const intoHalf = wall.axis === 'x' ? hd : hw
    const limit = wall.axis === 'x' ? halfW : halfD
    const wallLimit = wall.axis === 'x' ? halfD : halfW
    const step = alongHalf * 2
    if (!(step > 0)) continue

    const runCount = Math.floor((limit * 2) / step)
    if (runCount < 1) continue

    const runStart = -(runCount * step) / 2
    const offWall =
      wall.id === 'back' || wall.id === 'left'
        ? -wallLimit + intoHalf + WALL_MARGIN
        : wallLimit - intoHalf - WALL_MARGIN

    for (let i = 0; i < runCount; i++) {
      const along = runStart + step * i + alongHalf
      const x = wall.axis === 'x' ? along : offWall
      const z = wall.axis === 'x' ? offWall : along

      if (
        rackOverlapsOthers(
          { x, z, width, depth, rotationY: wall.rotationY },
          racks,
        )
      ) {
        continue
      }

      out.push({
        key: `${wall.id}-${i}`,
        x,
        z,
        rotationY: wall.rotationY,
      })
    }
  }

  return out
}
