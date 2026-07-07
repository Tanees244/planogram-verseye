// @ts-nocheck
'use client'

import type { FixtureShellProps } from '../types'
import { CustomRackMesh } from '../CustomRackMesh'
import { CustomRackSlotLayer } from '../CustomRackSlotLayer'
import { createBlankCustomRack } from '../customRackTypes'

export function CustomRackFixture({
  rack,
  hovered,
  isSelected,
  onSelect,
  onPointerOver,
  onPointerOut,
}: FixtureShellProps) {
  const config = rack.customConfig ?? createBlankCustomRack()
  const hasRows = rack.sides.some((s) => s.rows.length > 0)

  return (
    <>
      <CustomRackMesh
        config={config}
        hovered={hovered}
        isSelected={isSelected}
        onSelect={onSelect}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      />
      {hasRows && <CustomRackSlotLayer rack={rack} config={config} />}
    </>
  )
}
