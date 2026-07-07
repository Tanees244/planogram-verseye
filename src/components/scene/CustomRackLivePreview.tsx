'use client'

import { usePlanogramStore } from '@/store/planogramStore'
import { CustomRackMesh } from '@/components/fixtures/CustomRackMesh'
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes'

/** Live preview in the main 3D scene while the custom rack builder is open. */
export function CustomRackLivePreview() {
  const open = usePlanogramStore((s) => s.customRackBuilderOpen)
  const draft = usePlanogramStore((s) => s.customRackDraft)
  const editingId = usePlanogramStore((s) => s.editingCustomRackId)
  const racks = usePlanogramStore((s) => s.area.racks)

  if (!open) return null

  const editRack = editingId ? racks.find((r) => r.id === editingId) : null
  const pos = editRack?.position ?? { x: 0, y: 0, z: 0 }
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
