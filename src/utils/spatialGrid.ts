import {
  footprintsOverlap,
  rackFootprintRect,
  type FootprintRect,
} from '@/utils/rackPlacement'

export type SpatialAabb = {
  id: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Floor XZ hash — broad-phase for visibility + placement overlap. */
export class SpatialHashGrid {
  readonly cellSize: number
  private readonly cells = new Map<string, Set<string>>()
  private readonly items = new Map<string, SpatialAabb>()

  constructor(cellSize = 2) {
    this.cellSize = Math.max(0.5, cellSize)
  }

  get size() {
    return this.items.size
  }

  clear() {
    this.cells.clear()
    this.items.clear()
  }

  insert(item: SpatialAabb) {
    this.remove(item.id)
    this.items.set(item.id, item)
    for (const key of this.keysForAabb(item)) {
      let set = this.cells.get(key)
      if (!set) {
        set = new Set()
        this.cells.set(key, set)
      }
      set.add(item.id)
    }
  }

  remove(id: string) {
    const prev = this.items.get(id)
    if (!prev) return
    for (const key of this.keysForAabb(prev)) {
      const set = this.cells.get(key)
      if (!set) continue
      set.delete(id)
      if (set.size === 0) this.cells.delete(key)
    }
    this.items.delete(id)
  }

  get(id: string): SpatialAabb | undefined {
    return this.items.get(id)
  }

  /** Unique item ids whose AABB overlaps the query rect. */
  queryAabb(minX: number, maxX: number, minZ: number, maxZ: number): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const key of this.keysForRange(minX, maxX, minZ, maxZ)) {
      const set = this.cells.get(key)
      if (!set) continue
      for (const id of set) {
        if (seen.has(id)) continue
        const item = this.items.get(id)
        if (!item) continue
        if (
          item.maxX < minX ||
          item.minX > maxX ||
          item.maxZ < minZ ||
          item.minZ > maxZ
        ) {
          continue
        }
        seen.add(id)
        out.push(id)
      }
    }
    return out
  }

  queryPoint(x: number, z: number, radius: number): string[] {
    return this.queryAabb(x - radius, x + radius, z - radius, z + radius)
  }

  private cellCoord(v: number) {
    return Math.floor(v / this.cellSize)
  }

  private cellKey(cx: number, cz: number) {
    return `${cx},${cz}`
  }

  private *keysForAabb(a: SpatialAabb): Generator<string> {
    yield* this.keysForRange(a.minX, a.maxX, a.minZ, a.maxZ)
  }

  private *keysForRange(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
  ): Generator<string> {
    const x0 = this.cellCoord(minX)
    const x1 = this.cellCoord(maxX)
    const z0 = this.cellCoord(minZ)
    const z1 = this.cellCoord(maxZ)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        yield this.cellKey(cx, cz)
      }
    }
  }
}

export type RackSpatialInput = {
  id: string
  position: { x: number; z: number }
  width: number
  depth: number
  rotation?: { y?: number } | null
}

export function rackToSpatialAabb(rack: RackSpatialInput): SpatialAabb {
  const rect = rackFootprintRect(
    rack.position.x,
    rack.position.z,
    rack.width,
    rack.depth,
    rack.rotation?.y ?? 0,
  )
  return { id: rack.id, ...rect }
}

/** Rebuild a floor hash from the current rack list. */
export function buildRackSpatialGrid(
  racks: RackSpatialInput[],
  cellSize = 2,
): SpatialHashGrid {
  const grid = new SpatialHashGrid(cellSize)
  for (const rack of racks) {
    grid.insert(rackToSpatialAabb(rack))
  }
  return grid
}

/**
 * Overlap test using the spatial hash when the store is large enough
 * that O(n) scanning is wasteful.
 */
export function rackOverlapsOthersSpatial(
  candidate: {
    x: number
    z: number
    width: number
    depth: number
    rotationY?: number
    excludeId?: string | null
  },
  racks: RackSpatialInput[],
  opts?: { cellSize?: number; gap?: number; linearThreshold?: number },
): boolean {
  const gap = opts?.gap ?? 0.02
  const linearThreshold = opts?.linearThreshold ?? 12
  const a = rackFootprintRect(
    candidate.x,
    candidate.z,
    candidate.width,
    candidate.depth,
    candidate.rotationY ?? 0,
  )

  if (racks.length < linearThreshold) {
    return racks.some((other) => {
      if (candidate.excludeId && other.id === candidate.excludeId) return false
      const b = rackFootprintRect(
        other.position.x,
        other.position.z,
        other.width,
        other.depth,
        other.rotation?.y ?? 0,
      )
      return footprintsOverlap(a, b, gap)
    })
  }

  const grid = buildRackSpatialGrid(racks, opts?.cellSize ?? 2)
  const ids = grid.queryAabb(a.minX - gap, a.maxX + gap, a.minZ - gap, a.maxZ + gap)
  for (const id of ids) {
    if (candidate.excludeId && id === candidate.excludeId) continue
    const item = grid.get(id)
    if (!item) continue
    const b: FootprintRect = {
      minX: item.minX,
      maxX: item.maxX,
      minZ: item.minZ,
      maxZ: item.maxZ,
    }
    if (footprintsOverlap(a, b, gap)) return true
  }
  return false
}
