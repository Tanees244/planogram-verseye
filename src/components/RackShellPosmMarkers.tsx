'use client'

import { Edges } from '@react-three/drei'
import { DoubleSide } from 'three'
import type { RackShell, RackSurfacePosm } from '@/types/rackBlueprint'
import {
  computeCustomRackDimensions,
  resolveSectionSize,
  type CustomRackConfig,
} from '@/components/fixtures/customRackTypes'
import { usePosmImageSrc } from '@/hooks/usePosmImageSrc'
import { usePosmTexture } from '@/hooks/usePosmTexture'

const POSM_TYPE_COLORS: Record<string, string> = {
  Standee: '#8e44ad',
  ShelfTalker: '#27ae60',
  Flyer: '#2980b9',
}

function PosmColorPlaque({
  posm,
  position,
  size,
  rotation,
}: {
  posm: RackSurfacePosm
  position: [number, number, number]
  size: [number, number, number]
  rotation?: [number, number, number]
}) {
  const color = POSM_TYPE_COLORS[posm.posmType] ?? '#2C5282'
  return (
    <mesh position={position} rotation={rotation} raycast={() => null}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.45}
        metalness={0.15}
        roughness={0.45}
      />
      <Edges color="#ffffff" threshold={15} lineWidth={1.5} />
    </mesh>
  )
}

function PosmSurface({
  posm,
  position,
  size,
  rotation,
}: {
  posm: RackSurfacePosm
  position: [number, number, number]
  /** box size [w,h,d] used for color plaque fallback */
  size: [number, number, number]
  rotation?: [number, number, number]
}) {
  const imageUrl = usePosmImageSrc(posm)
  const texture = usePosmTexture(imageUrl)

  if (!texture) {
    return <PosmColorPlaque posm={posm} position={position} size={size} rotation={rotation} />
  }

  return (
    <mesh position={position} rotation={rotation} raycast={() => null}>
      <planeGeometry args={[size[0], size[1]]} />
      <meshStandardMaterial
        map={texture}
        transparent
        toneMapped={false}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

/** POSM images (or colored plaques) on rack shell surfaces. */
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
  const bodyBottomY = bottomY + dims.footerH
  const bodyCenterY = bodyBottomY + dims.bodyH / 2
  const bodyTopY = bodyBottomY + dims.bodyH
  const headerCenterY = bodyTopY + dims.headerH / 2
  const footerCenterY = bottomY + dims.footerH / 2

  const footerFullBase = footerSize.depth >= d * 0.85
  const footerZ = footerFullBase ? 0 : -d / 2 - config.footer.protrusion + footerSize.depth / 2
  const headerZ = -d / 2 - config.header.protrusion + headerSize.depth / 2

  // Place wall art clearly OUTSIDE the opaque wall mesh (was buried inside thickness).
  const wallClearance = Math.max(0.02, wt * 0.35)
  const wallPlaneW = Math.max(0.2, d - wt * 2)
  const wallPlaneH = Math.max(0.2, dims.bodyH * 0.88)

  const markers: React.ReactNode[] = []

  if (shell.headerPosm) {
    const hasBand = config.header.enabled && dims.headerH > 0
    markers.push(
      <PosmSurface
        key="header"
        posm={shell.headerPosm}
        position={[
          0,
          hasBand ? headerCenterY : bodyTopY + 0.1,
          headerZ - (hasBand ? headerSize.depth / 2 : 0) - 0.02,
        ]}
        size={[Math.min(headerSize.width * 0.92, w * 0.92), hasBand ? dims.headerH * 0.88 : 0.22, 0.012]}
        rotation={[0, Math.PI, 0]}
      />,
    )
  }

  if (shell.footerPosm) {
    const hasBand = config.footer.enabled && dims.footerH > 0
    markers.push(
      <PosmSurface
        key="footer"
        posm={shell.footerPosm}
        position={[
          0,
          hasBand ? footerCenterY : bodyBottomY + 0.08,
          footerZ - (hasBand ? footerSize.depth / 2 : 0) - 0.02,
        ]}
        size={[Math.min(footerSize.width * 0.92, w * 0.92), hasBand ? dims.footerH * 0.88 : 0.18, 0.012]}
        rotation={[0, Math.PI, 0]}
      />,
    )
  }

  // Show wall POSM whenever assigned — even if shell walls flag is off in config
  if (shell.leftWallPosm) {
    markers.push(
      <PosmSurface
        key="left"
        posm={shell.leftWallPosm}
        position={[-w / 2 - wallClearance, bodyCenterY, 0]}
        size={[wallPlaneW, wallPlaneH, 0.012]}
        // Face outward (−X) so the image is visible from the left side of the rack
        rotation={[0, -Math.PI / 2, 0]}
      />,
    )
  }

  if (shell.rightWallPosm) {
    markers.push(
      <PosmSurface
        key="right"
        posm={shell.rightWallPosm}
        position={[w / 2 + wallClearance, bodyCenterY, 0]}
        size={[wallPlaneW, wallPlaneH, 0.012]}
        // Face outward (+X)
        rotation={[0, Math.PI / 2, 0]}
      />,
    )
  }

  if (markers.length === 0) return null
  return <group>{markers}</group>
}
