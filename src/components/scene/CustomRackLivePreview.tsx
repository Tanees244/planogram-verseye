'use client'

import { usePlanogramStore } from '@/store/planogramStore'
import { CustomRackMesh } from '@/components/fixtures/CustomRackMesh'
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes'

/** Live preview in the main 3D scene while editing an existing custom rack.
 *  New-rack builds preview inside the CustomRackBuilder modal instead. */
export function CustomRackLivePreview() {
  const open = usePlanogramStore((s) => s.customRackBuilderOpen)
  const draft = usePlanogramStore((s) => s.customRackDraft)
  const editingId = usePlanogramStore((s) => s.editingCustomRackId)
  const racks = usePlanogramStore((s) => s.area.racks)

  // New builds preview in the modal; only sync-edit existing racks on the floor.
  if (!open || !editingId) return null

  const editRack = racks.find((r) => r.id === editingId)
  if (!editRack) return null
  const pos = editRack.position
  const dims = computeCustomRackDimensions(draft)
  const groupY = dims.totalHeight / 2 + 0.02

  return (
    <group position={[pos.x, groupY, pos.z]}>
      <CustomRackMesh config={draft} isPreview />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -groupY + 0.03, 0]}>
        <ringGeometry args={[draft.outerWidth * 0.55, draft.outerWidth * 0.6, 32]} />
        <meshBasicMaterial color="#2C5282" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}
