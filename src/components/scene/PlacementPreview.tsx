'use client'

import { Html } from '@react-three/drei'
import { usePlanogramStore } from '@/store/planogramStore'
import { FIXTURE_LIBRARY } from '@/components/fixtures/types'
import { computeFixtureMetrics } from '@/components/fixtures/fixtureMetrics'
import { CustomRackMesh } from '@/components/fixtures/CustomRackMesh'
import type { Rack } from '@/store/planogramStore'
import { formatCmPair, formatCmTriple } from '@/utils/lengthUnits'

interface PlacementPreviewProps {
  position: { x: number; z: number; rotationY: number; overlaps?: boolean } | null
}

/** Ghost outline showing where the fixture will land. */
export function PlacementPreview({ position }: PlacementPreviewProps) {
  const pending = usePlanogramStore((s) => s.pendingRackParams)
  const placingType = usePlanogramStore((s) => s.placingFixtureType)
  const isPlacing = usePlanogramStore((s) => s.isPlacingRack)
  const editingRackId = usePlanogramStore((s) => s.editingRackId)
  const racks = usePlanogramStore((s) => s.area.racks)

  const movingRack = editingRackId
    ? racks.find((r) => r.id === editingRackId)
    : null

  if ((!isPlacing && !movingRack) || !position) return null
  if (isPlacing && (!pending || !placingType)) return null

  const width = pending?.width ?? movingRack?.width ?? 1
  const depth = pending?.depth ?? movingRack?.depth ?? 1
  const fixtureType = placingType ?? movingRack?.fixtureType ?? 'GONDOLA'
  const customConfig = pending?.customConfig ?? movingRack?.customConfig
  const overlap = Boolean(position.overlaps)
  const color = overlap ? '#dc2626' : '#2C5282'
  const label =
    (placingType && FIXTURE_LIBRARY[placingType]?.label) ||
    movingRack?.blueprintName ||
    movingRack?.rackCode ||
    'Fixture'

  const ghostRack: Rack = {
    id: 'preview',
    rackId: 'preview',
    rackCode: pending?.rackCode ?? movingRack?.rackCode ?? 'preview',
    width,
    depth,
    fixtureType: fixtureType as Rack['fixtureType'],
    customConfig,
    position: { x: position.x, y: 0, z: position.z },
    sides: [],
    isDoubleSided: pending?.sided === 'two' || movingRack?.isDoubleSided,
  }

  const { groupY, rackHeight } = computeFixtureMetrics(ghostRack)
  const displayH = customConfig?.outerHeight ?? rackHeight

  const dimBadge = (
    <Html
      position={[0, displayH + 0.35, 0]}
      center
      zIndexRange={[55, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: overlap ? 'rgba(153,27,27,0.95)' : 'rgba(30,64,175,0.95)',
          color: '#fff',
          padding: '6px 10px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          border: '1px solid rgba(255,255,255,0.25)',
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
        }}
      >
        {label}: {formatCmTriple(width, depth, displayH)}
      </div>
    </Html>
  )

  if (fixtureType === 'CUSTOM' && customConfig) {
    return (
      <group position={[position.x, groupY, position.z]} rotation={[0, position.rotationY, 0]}>
        <CustomRackMesh config={customConfig} isPreview />
        {dimBadge}
      </group>
    )
  }

  return (
    <group position={[position.x, groupY, position.z]} rotation={[0, position.rotationY, 0]}>
      <mesh>
        <boxGeometry args={[width, rackHeight, depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.25}
          wireframe={false}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[width + 0.05, rackHeight + 0.05, depth + 0.05]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
      </mesh>
      {dimBadge}
    </group>
  )
}

export function placementHintLabel(placingType: string | null, pending: { width: number; depth: number } | null) {
  if (!placingType || !pending) return 'Click the floor to place — snaps to grid / walls'
  const label = FIXTURE_LIBRARY[placingType as keyof typeof FIXTURE_LIBRARY]?.label ?? 'Fixture'
  return `Place ${label} (${formatCmPair(pending.width, pending.depth)})`
}
