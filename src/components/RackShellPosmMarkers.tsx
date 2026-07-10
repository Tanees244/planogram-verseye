'use client'

import { Edges } from '@react-three/drei'
import type { RackShell } from '@/types/rackBlueprint'
import {
  computeCustomRackDimensions,
  resolveSectionSize,
  type CustomRackConfig,
} from '@/components/fixtures/customRackTypes'
import type { RackSurfacePosm } from '@/types/rackBlueprint'

const POSM_TYPE_COLORS: Record<string, string> = {
  Standee: '#8e44ad',
  ShelfTalker: '#27ae60',
  Flyer: '#2980b9',
}

function PosmPlaque({
  posm,
  position,
  size,
}: {
  posm: RackSurfacePosm
  position: [number, number, number]
  size: [number, number, number]
}) {
  const color = POSM_TYPE_COLORS[posm.posmType] ?? '#2C5282'
  return (
    <mesh position={position} raycast={() => null}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} metalness={0.15} roughness={0.45} />
      <Edges color="#ffffff" threshold={15} lineWidth={1.5} />
    </mesh>
  )
}

/** Colored markers on rack shell surfaces when header/footer/wall POSM is assigned. */
export function RackShellPosmMarkers({
  config,
  shell,
}: {
  config: CustomRackConfig
  shell?: RackShell | null
}) {
  if (!shell) return null

  const dims = computeCustomRackDimensions(config)
  const { outerWidth: w, outerDepth: d, wallThickness: wt } = config
  const headerSize = resolveSectionSize(config.header, w, d, 'header')
  const footerSize = resolveSectionSize(config.footer, w, d, 'footer')
  const bottomY = -dims.totalHeight / 2
  const bodyTopY = bottomY + dims.footerH + dims.bodyH
  const headerCenterY = bodyTopY + dims.headerH / 2
  const footerCenterY = bottomY + dims.footerH / 2

  const footerFullBase = footerSize.depth >= d * 0.85
  const footerZ = footerFullBase ? 0 : -d / 2 - config.footer.protrusion + footerSize.depth / 2
  const headerZ = -d / 2 - config.header.protrusion + headerSize.depth / 2
  const frontZ = -d / 2 - 0.03

  const markers: React.ReactNode[] = []

  if (shell.headerPosm && config.header.enabled && dims.headerH > 0) {
    markers.push(
      <PosmPlaque
        key="header"
        posm={shell.headerPosm}
        position={[0, headerCenterY, headerZ - headerSize.depth / 2 - 0.02]}
        size={[Math.min(headerSize.width * 0.5, 0.5), dims.headerH * 0.55, 0.02]}
      />,
    )
  }

  if (shell.footerPosm && config.footer.enabled && dims.footerH > 0) {
    markers.push(
      <PosmPlaque
        key="footer"
        posm={shell.footerPosm}
        position={[0, footerCenterY, footerZ - footerSize.depth / 2 - 0.02]}
        size={[Math.min(footerSize.width * 0.5, 0.5), dims.footerH * 0.55, 0.02]}
      />,
    )
  }

  if (shell.leftWallPosm && config.walls.left) {
    markers.push(
      <PosmPlaque
        key="left"
        posm={shell.leftWallPosm}
        position={[-w / 2 + wt / 2 - 0.02, bottomY + dims.footerH + dims.bodyH / 2, frontZ]}
        size={[0.02, dims.bodyH * 0.35, Math.min(d * 0.35, 0.45)]}
      />,
    )
  }

  if (shell.rightWallPosm && config.walls.right) {
    markers.push(
      <PosmPlaque
        key="right"
        posm={shell.rightWallPosm}
        position={[w / 2 - wt / 2 + 0.02, bottomY + dims.footerH + dims.bodyH / 2, frontZ]}
        size={[0.02, dims.bodyH * 0.35, Math.min(d * 0.35, 0.45)]}
      />,
    )
  }

  if (markers.length === 0) return null
  return <group>{markers}</group>
}
