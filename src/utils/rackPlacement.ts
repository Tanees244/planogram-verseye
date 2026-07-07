import { WALL_SNAP_THRESHOLD } from '@/constants/warehouse'

export interface RackPlacement {
  x: number
  z: number
  rotationY: number
  snapped: boolean
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
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

/**
 * Snap a rack against the nearest sales-floor wall and rotate it to face inward.
 * Back of rack (-Z local) sits on the wall; front faces the store.
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
    return { x: point.x, z: point.z, rotationY: 0, snapped: false }
  }

  if (min === distBack) {
    const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(rackWidth, rackDepth, 0)
    return {
      x: clamp(point.x, -halfW + hw, halfW - hw),
      z: -halfD + hd + margin,
      rotationY: 0,
      snapped: true,
    }
  }

  if (min === distFront) {
    const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(rackWidth, rackDepth, Math.PI)
    return {
      x: clamp(point.x, -halfW + hw, halfW - hw),
      z: halfD - hd - margin,
      rotationY: Math.PI,
      snapped: true,
    }
  }

  if (min === distLeft) {
    const rot = Math.PI / 2
    const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(rackWidth, rackDepth, rot)
    return {
      x: -halfW + hw + margin,
      z: clamp(point.z, -halfD + hd, halfD - hd),
      rotationY: rot,
      snapped: true,
    }
  }

  const rot = -Math.PI / 2
  const { halfW: hw, halfD: hd } = getRotatedFootprintHalf(rackWidth, rackDepth, rot)
  return {
    x: halfW - hw - margin,
    z: clamp(point.z, -halfD + hd, halfD - hd),
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
