// @ts-nocheck
'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'
import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { computeFixtureMetrics } from './fixtureMetrics'
import { resolveFixtureType, type FixtureType } from './types'
import { DEFAULT_RACK_WIDTH } from '@/constants/dimensions'
import { safeDim, safePosition } from '@/utils/safeDimensions'
import { GondolaFixture } from './procedural/GondolaFixture'
import { WallBayFixture } from './procedural/WallBayFixture'
import { EndCapFixture } from './procedural/EndCapFixture'
import { DumpBinFixture } from './procedural/DumpBinFixture'
import { PalletDisplayFixture } from './procedural/PalletDisplayFixture'
import { RefrigeratedFixture } from './procedural/RefrigeratedFixture'
import { FreezerFixture } from './procedural/FreezerFixture'
import { PegboardFixture } from './procedural/PegboardFixture'
import { CheckoutFixture } from './procedural/CheckoutFixture'
import { PromotionalFixture } from './procedural/PromotionalFixture'
import { CustomRackFixture } from './procedural/CustomRackFixture'
import { RackShellPosmMarkers } from '@/components/RackShellPosmMarkers'
import { createBlankCustomRack } from './customRackTypes'

interface FixtureRendererProps {
  rack: Rack
}

const FIXTURE_COMPONENTS: Record<
  FixtureType,
  React.ComponentType<import('./types').FixtureShellProps>
> = {
  GONDOLA: GondolaFixture,
  WALL_BAY: WallBayFixture,
  END_CAP: EndCapFixture,
  DUMP_BIN: DumpBinFixture,
  PALLET_DISPLAY: PalletDisplayFixture,
  REFRIGERATED: RefrigeratedFixture,
  FREEZER: FreezerFixture,
  PEGBOARD: PegboardFixture,
  CHECKOUT: CheckoutFixture,
  PROMOTIONAL: PromotionalFixture,
  CUSTOM: CustomRackFixture,
}

export function FixtureRenderer({ rack }: FixtureRendererProps) {
  const meshRef = useRef<Mesh>(null)
  const { selectedId, setSelected } = usePlanogramStore()
  const [hovered, setHovered] = useState(false)

  const isSelected = selectedId === rack.id
  const { rackHeight, groupY } = computeFixtureMetrics(rack)
  const hasContent = rack.sides.some((s) => s.rows.length > 0)
  const fixtureType = resolveFixtureType(rack)
  const rot = rack.rotation ?? { x: 0, y: 0, z: 0 }

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.02 : 1)
    }
  })

  const onSelect = (e: unknown) => {
    ;(e as { stopPropagation?: () => void }).stopPropagation?.()
    setSelected(rack.id, 'rack')
  }
  const onPointerOver = (e: unknown) => {
    ;(e as { stopPropagation?: () => void }).stopPropagation?.()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const onPointerOut = () => {
    setHovered(false)
    document.body.style.cursor = 'default'
  }

  const Shell = FIXTURE_COMPONENTS[fixtureType] ?? GondolaFixture

  const rackW = safeDim(rack.width, DEFAULT_RACK_WIDTH)
  const rackD = safeDim(rack.depth, 2)

  return (
    <group
      userData={{ id: rack.id, fixtureType }}
      position={[safePosition(rack.position.x, 0), groupY, safePosition(rack.position.z, 0)]}
      rotation={[rot.x, rot.y, rot.z]}
    >
      <Shell
        rack={rack}
        rackHeight={rackHeight}
        hasContent={hasContent}
        hovered={hovered}
        isSelected={isSelected}
        onSelect={onSelect}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />

      {/* Custom racks render POSM inside CustomRackFixture; presets get markers here. */}
      {fixtureType !== 'CUSTOM' && rack.shell && (
        <RackShellPosmMarkers
          config={{
            ...createBlankCustomRack(),
            outerWidth: rackW,
            outerDepth: rackD,
            outerHeight: rackHeight,
            header: {
              ...createBlankCustomRack().header,
              enabled: true,
              height: Math.min(0.28, rackHeight * 0.12),
            },
            footer: {
              ...createBlankCustomRack().footer,
              enabled: true,
              height: Math.min(0.18, rackHeight * 0.08),
            },
            walls: { back: true, left: true, right: true, frontGlass: false },
          }}
          shell={rack.shell}
        />
      )}

      {isSelected && (
        <mesh ref={meshRef} raycast={() => null}>
          <boxGeometry args={[rackW + 0.3, rackHeight + 0.3, rackD + 0.3]} />
          <meshStandardMaterial color="#2C5282" transparent opacity={0.1} wireframe />
        </mesh>
      )}
    </group>
  )
}
