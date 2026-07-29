import { WALL_SNAP_THRESHOLD } from '@/constants/warehouse'

export interface RackPlacement {
  x: number
  z: number
  rotationY: number
  snapped: boolean
}

/** Floor grid spacing (meters) for place/move alignment. */
export const FLOOR_GRID_SIZE_M = 0.25

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function snapToGrid(value: number, grid = FLOOR_GRID_SIZE_M): number {
  if (!(grid > 0)) return value
  return Math.round(value / grid) * grid
}

/** Footprint half-extents after Y rotation (for bounds checks). */
export function getRotatedFootprintHalf(
  width: number,
  depth: number,
  rotationY: number,
): { halfW: number; halfD: number } {
  const s = Math.abs(Math.sin(rotationY))
  const c = Math.abs(Math.cos(rotationY))
  return {
    halfW: (width * c + depth * s) / 2,
    halfD: (width * s + depth * c) / 2,
  }
}

export type FootprintRect = { minX: number; maxX: number; minZ: number; maxZ: number }

export function rackFootprintRect(
  x: number,
  z: number,
  width: number,
  depth: number,
  rotationY = 0,
): FootprintRect {
  const { halfW, halfD } = getRotatedFootprintHalf(width, depth, rotationY)
  return {
    minX: x - halfW,
    maxX: x + halfW,
    minZ: z - halfD,
    maxZ: z + halfD,
  }
}

export function footprintsOverlap(a: FootprintRect, b: FootprintRect, gap = 0.02): boolean {
  return (
    a.minX < b.maxX - gap &&
    a.maxX > b.minX + gap &&
    a.minZ < b.maxZ - gap &&
    a.maxZ > b.minZ + gap
  )
}

/** True if a candidate footprint overlaps any existing rack (optional exclude id). */
export function rackOverlapsOthers(
  candidate: {
    x: number
    z: number
    width: number
    depth: number
    rotationY?: number
    excludeId?: string | null
  },
  racks: Array<{
    id: string
    position: { x: number; z: number }
    width: number
    depth: number
    rotation?: { y?: number } | null
  }>,
): boolean {
  const a = rackFootprintRect(
    candidate.x,
    candidate.z,
    candidate.width,
    candidate.depth,
    candidate.rotationY ?? 0,
  )
  return racks.some((other) => {
    if (candidate.excludeId && other.id === candidate.excludeId) return false
    const b = rackFootprintRect(
      other.position.x,
      other.position.z,
      other.width,
      other.depth,
      other.rotation?.y ?? 0,
    )
    return footprintsOverlap(a, b)
  })
}

/**
 * Snap a rack against the nearest sales-floor wall and rotate it so the
 * shopper front (local −Z) faces the aisle / inward — back panel to the wall.
 * When not near a wall, snap X/Z to the floor grid for aisle alignment.
 */
export function snapRackToWall(
  point: { x: number; z: number },
  rackWidth: number,
  rackDepth: number,
  areaWidth: number,
  areaDepth: number,
  snapThreshold = WALL_SNAP_THRESHOLD,
): RackPlacement {
  const halfW = areaWidth / 2
  const halfD = areaDepth / 2
  const margin = 0.12

  const distBack = Math.abs(point.z - -halfD)
  const distFront = Math.abs(point.z - halfD)
  const distLeft = Math.abs(point.x - -halfW)
  const distRight = Math.abs(point.x - halfW)

  const min = Math.min(distBack, distFront, distLeft, distRight)

  if (min > snapThreshold) {
    return {
      x: snapToGrid(point.x),
      z: snapToGrid(point.z),
      rotationY: 0,
      snapped: false,
    }
  }

  // Local −Z = open/shopper front. Yaw so −Z points into the store (away from wall).
  if (min === distBack) {
    // Floor −Z wall → face +Z (aisle)
    const rot = Math.PI
    const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(rackWidth, rackDepth, rot)
    return {
      x: snapToGrid(clamp(point.x, -halfW + hw, halfW - hw)),
      z: -halfD + hd + margin,
      rotationY: rot,
      snapped: true,
    }
  }

  if (min === distFront) {
    // Floor +Z wall → face −Z (aisle)
    const rot = 0
    const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(rackWidth, rackDepth, rot)
    return {
      x: snapToGrid(clamp(point.x, -halfW + hw, halfW - hw)),
      z: halfD - hd - margin,
      rotationY: rot,
      snapped: true,
    }
  }

  if (min === distLeft) {
    // Floor −X wall → face +X
    const rot = -Math.PI / 2
    const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(rackWidth, rackDepth, rot)
    return {
      x: -halfW + hw + margin,
      z: snapToGrid(clamp(point.z, -halfD + hd, halfD - hd)),
      rotationY: rot,
      snapped: true,
    }
  }

  // Floor +X wall → face −X
  const rot = Math.PI / 2
  const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(rackWidth, rackDepth, rot)
  return {
    x: halfW - hw - margin,
    z: snapToGrid(clamp(point.z, -halfD + hd, halfD - hd)),
    rotationY: rot,
    snapped: true,
  }
}

export function isRackInsideFloor(
  x: number,
  z: number,
  width: number,
  depth: number,
  rotationY: number,
  areaWidth: number,
  areaDepth: number,
): boolean {
  const { halfW, halfD } = getRotatedFootprintHalf(width, depth, rotationY)
  const floorHalfW = areaWidth / 2
  const floorHalfD = areaDepth / 2
  return (
    x - halfW >= -floorHalfW &&
    x + halfW <= floorHalfW &&
    z - halfD >= -floorHalfD &&
    z + halfD <= floorHalfD
  )
}
