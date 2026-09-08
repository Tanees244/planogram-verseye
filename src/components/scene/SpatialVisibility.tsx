'use client'

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlanogramStore, type Rack } from '@/store/planogramStore'
import { buildRackSpatialGrid } from '@/utils/spatialGrid'
import { DEFAULT_RACK_DEPTH, DEFAULT_RACK_HEIGHT, DEFAULT_RACK_WIDTH } from '@/constants/dimensions'
import { safeDim } from '@/utils/safeDimensions'
import { computeFixtureMetrics } from '@/components/fixtures/fixtureMetrics'

type SpatialVisibilityContextValue = {
  detailIds: ReadonlySet<string>
  allDetailed: boolean
}

const SpatialVisibilityContext = createContext<SpatialVisibilityContextValue>({
  detailIds: new Set(),
  allDetailed: true,
})

const ALWAYS_DETAIL_MAX_RACKS = 8
const FRUSTUM_PAD_M = 2.5
const NEAR_CAMERA_M = 14
const UPDATE_INTERVAL_S = 0.12

function racksFingerprint(racks: Rack[]): string {
  let s = `${racks.length}|`
  for (const r of racks) {
    s += `${r.id}:${r.position.x.toFixed(2)},${r.position.z.toFixed(2)},${(r.rotation?.y ?? 0).toFixed(2)},${r.width},${r.depth};`
  }
  return s
}

function setEqual(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

/**
 * Indexes racks on a floor spatial hash and keeps ids whose footprints
 * intersect the camera frustum (plus a near-camera ring). Far racks keep
 * their shell but skip Row → Bin → Product trees.
 */
export function SpatialVisibilityProvider({
  racks,
  children,
}: {
  racks: Rack[]
  children: ReactNode
}) {
  const camera = useThree((s) => s.camera)
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const editingRackId = usePlanogramStore((s) => s.editingRackId)

  const fp = racksFingerprint(racks)
  const grid = useMemo(
    () =>
      buildRackSpatialGrid(
        racks.map((r) => ({
          id: r.id,
          position: r.position,
          width: safeDim(r.width, DEFAULT_RACK_WIDTH),
          depth: safeDim(r.depth, DEFAULT_RACK_DEPTH),
          rotation: r.rotation,
        })),
        2.5,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fp],
  )

  const allDetailed = racks.length <= ALWAYS_DETAIL_MAX_RACKS
  const [detailIds, setDetailIds] = useState<ReadonlySet<string>>(
    () => new Set(racks.map((r) => r.id)),
  )

  const frustum = useRef(new THREE.Frustum())
  const projScreen = useRef(new THREE.Matrix4())
  const camPos = useRef(new THREE.Vector3())
  const accum = useRef(0)
  const boxesById = useRef(new Map<string, THREE.Box3>())
  const detailIdsRef = useRef(detailIds)
  detailIdsRef.current = detailIds

  useMemo(() => {
    const map = new Map<string, THREE.Box3>()
    for (const r of racks) {
      const item = grid.get(r.id)
      if (!item) continue
      const h = Math.max(computeFixtureMetrics(r).rackHeight, DEFAULT_RACK_HEIGHT * 0.25, 1.5)
      map.set(
        r.id,
        new THREE.Box3(
          new THREE.Vector3(item.minX, 0, item.minZ),
          new THREE.Vector3(item.maxX, h, item.maxZ),
        ),
      )
    }
    boxesById.current = map
  }, [racks, grid])

  useFrame((_, dt) => {
    if (allDetailed) return
    accum.current += dt
    if (accum.current < UPDATE_INTERVAL_S) return
    accum.current = 0

    camera.getWorldPosition(camPos.current)
    projScreen.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    )
    frustum.current.setFromProjectionMatrix(projScreen.current)

    const cx = camPos.current.x
    const cz = camPos.current.z
    const near = Math.max(NEAR_CAMERA_M, camPos.current.y * 1.2)

    const candidates = new Set<string>(grid.queryPoint(cx, cz, near + FRUSTUM_PAD_M))
    const window = near + FRUSTUM_PAD_M * 2
    for (const id of grid.queryAabb(cx - window, cx + window, cz - window, cz + window)) {
      candidates.add(id)
    }

    const next = new Set<string>()
    if (selectedId) next.add(selectedId)
    if (editingRackId) next.add(editingRackId)

    for (const id of candidates) {
      const b = boxesById.current.get(id)
      if (!b) {
        next.add(id)
        continue
      }
      const item = grid.get(id)
      if (item) {
        const mx = (item.minX + item.maxX) * 0.5
        const mz = (item.minZ + item.maxZ) * 0.5
        const dx = mx - cx
        const dz = mz - cz
        if (dx * dx + dz * dz <= near * near) {
          next.add(id)
          continue
        }
      }
      if (frustum.current.intersectsBox(b)) next.add(id)
    }

    for (const id of detailIdsRef.current) {
      if (!candidates.has(id)) continue
      const b = boxesById.current.get(id)
      if (b && frustum.current.intersectsBox(b)) next.add(id)
    }

    if (!setEqual(detailIdsRef.current, next)) setDetailIds(next)
  })

  const value = useMemo(
    () => ({
      detailIds: allDetailed ? new Set(racks.map((r) => r.id)) : detailIds,
      allDetailed,
    }),
    [allDetailed, detailIds, racks],
  )

  return (
    <SpatialVisibilityContext.Provider value={value}>
      {children}
    </SpatialVisibilityContext.Provider>
  )
}

/** True when this rack should mount Row → Bin → Product (GLB) trees. */
export function useRackDetailVisible(rackId: string): boolean {
  const { detailIds, allDetailed } = useContext(SpatialVisibilityContext)
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const editingRackId = usePlanogramStore((s) => s.editingRackId)
  if (allDetailed) return true
  if (selectedId === rackId || editingRackId === rackId) return true
  return detailIds.has(rackId)
}
