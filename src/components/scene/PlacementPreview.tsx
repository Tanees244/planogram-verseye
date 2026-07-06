'use client'

import { usePlanogramStore } from '@/store/planogramStore'
import { FIXTURE_LIBRARY } from '@/components/fixtures/types'
import { computeFixtureMetrics } from '@/components/fixtures/fixtureMetrics'
import type { Rack } from '@/store/planogramStore'

interface PlacementPreviewProps {
  position: { x: number; z: number } | null
}

/** Ghost outline showing where the fixture will land. */
export function PlacementPreview({ position }: PlacementPreviewProps) {
  const pending = usePlanogramStore((s) => s.pendingRackParams)
  const placingType = usePlanogramStore((s) => s.placingFixtureType)
  const isPlacing = usePlanogramStore((s) => s.isPlacingRack)

  if (!isPlacing || !pending || !position || !placingType) return null

  const ghostRack: Rack = {
    id: 'preview',
    rackId: 'preview',
    rackCode: pending.rackCode ?? 'preview',
    width: pending.width,
    depth: pending.depth,
    fixtureType: placingType,
    position: { x: position.x, y: 0, z: position.z },
    sides: [],
    isDoubleSided: pending.sided === 'two',
  }

  const { rackHeight, groupY } = computeFixtureMetrics(ghostRack)

  return (
    <group position={[position.x, groupY, position.z]}>
      <mesh>
        <boxGeometry args={[pending.width, rackHeight, pending.depth]} />
        <meshStandardMaterial
          color="#2C5282"
          transparent
          opacity={0.25}
          wireframe={false}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[pending.width + 0.05, rackHeight + 0.05, pending.depth + 0.05]} />
        <meshBasicMaterial color="#2C5282" wireframe transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

export function placementHintLabel(placingType: string | null, pending: { width: number; depth: number } | null) {
  if (!placingType || !pending) return 'Click anywhere on the floor to place fixture'
  const label = FIXTURE_LIBRARY[placingType as keyof typeof FIXTURE_LIBRARY]?.label ?? 'Fixture'
  return `Place ${label} (${pending.width}m × ${pending.depth}m) — click floor or drop from palette`
}
