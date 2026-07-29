'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import { FixtureRenderer } from '@/components/fixtures/FixtureRenderer'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  buildWallGuideRack,
  computeWallGuideSlots,
} from '@/utils/wallGuideRacks'

/** Disable picking so guide racks never steal clicks from the floor / real racks. */
function NonInteractive({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    root.traverse((obj) => {
      obj.raycast = () => {}
    })
  })
  return <group ref={ref}>{children}</group>
}

/**
 * One-sided WALL_BAY racks tiled along the walls — same shell / shelves / sample
 * SKUs as a real fixture, but non-interactive guides only.
 */
export function WallRackGuides() {
  const visible = usePlanogramStore((s) => s.wallGuidesVisible)
  const areaWidth = usePlanogramStore((s) => s.area.width)
  const areaDepth = usePlanogramStore((s) => s.area.depth)
  const racks = usePlanogramStore((s) => s.area.racks)

  const guideRacks = useMemo(() => {
    if (!visible) return []
    return computeWallGuideSlots(areaWidth, areaDepth, racks).map(buildWallGuideRack)
  }, [visible, areaWidth, areaDepth, racks])

  if (guideRacks.length === 0) return null

  return (
    <NonInteractive>
      {guideRacks.map((rack) => (
        <FixtureRenderer key={rack.id} rack={rack} interactive={false} />
      ))}
    </NonInteractive>
  )
}
