'use client'

import { Edges } from '@react-three/drei'
import {
  computeCustomRackDimensions,
  resolveSectionSize,
  type CustomRackConfig,
} from '@/components/fixtures/customRackTypes'

export interface CustomRackMeshProps {
  config: CustomRackConfig
  hovered?: boolean
  isSelected?: boolean
  isPreview?: boolean
  onSelect?: (e: unknown) => void
  onPointerOver?: (e: unknown) => void
  onPointerOut?: () => void
}

const POST_COLOR = '#1a1a1a'
const WALL_COLOR = '#e8eaed'
const PEG_COLOR = '#d5d8dc'

/** Front (-Z) anchor for header fascia / footer kick plate. */
function sectionFrontZ(outerDepth: number, sectionDepth: number, protrusion: number): number {
  return -outerDepth / 2 - protrusion + sectionDepth / 2
}

/** Hollow 3-wall bay shell — back + sides open at front. Rows come from planogram slots. */
export function CustomRackMesh({
  config,
  hovered = false,
  isSelected = false,
  isPreview = false,
  onSelect,
  onPointerOver,
  onPointerOut,
}: CustomRackMeshProps) {
  const bind = onSelect
    ? { onClick: onSelect, onPointerOver, onPointerOut }
    : {}

  const dims = computeCustomRackDimensions(config)
  const { outerWidth: w, outerDepth: d, wallThickness: wt } = config
  const headerSize = resolveSectionSize(config.header, w, d, 'header')
  const footerSize = resolveSectionSize(config.footer, w, d, 'footer')
  const totalH = dims.totalHeight
  const emissive = hovered || isSelected ? '#2C5282' : '#000000'
  const emissiveInt = hovered ? 0.35 : isSelected ? 0.18 : 0
  const opacity = isPreview ? 0.92 : 1

  const bottomY = -totalH / 2
  const bodyBottomY = bottomY + dims.footerH
  const bodyCenterY = bodyBottomY + dims.bodyH / 2
  const bodyTopY = bodyBottomY + dims.bodyH
  const headerCenterY = bodyTopY + dims.headerH / 2
  const footerCenterY = bottomY + dims.footerH / 2

  const postR = wt * 0.45
  const innerW = dims.innerWidth
  const innerD = dims.innerDepth
  const isDoubleSided = Boolean(config.isDoubleSided)
  // One-sided: cavity in front of back wall. Two-sided: full depth around center divider.
  const cavityZ = isDoubleSided ? 0 : -d / 2 + wt + innerD / 2
  const cavityDepth = isDoubleSided ? d - wt : innerD
  const dividerZ = isDoubleSided ? 0 : d / 2 - wt / 2
  const footerFullBase = footerSize.depth >= d * 0.85
  const footerZ = footerFullBase ? 0 : sectionFrontZ(d, footerSize.depth, config.footer.protrusion)
  const headerZ = isDoubleSided
    ? 0
    : sectionFrontZ(d, headerSize.depth, config.header.protrusion)

  const wallMat = (
    <meshStandardMaterial
      color={WALL_COLOR}
      metalness={0.25}
      roughness={0.65}
      emissive={emissive}
      emissiveIntensity={emissiveInt}
      transparent={isPreview}
      opacity={opacity}
    />
  )

  const postPositions: [number, number, number][] = [
    [-w / 2 + postR, bodyBottomY, -d / 2 + postR],
    [w / 2 - postR, bodyBottomY, -d / 2 + postR],
    [-w / 2 + postR, bodyBottomY, d / 2 - postR],
    [w / 2 - postR, bodyBottomY, d / 2 - postR],
  ]

  return (
    <group>
      {/* Full outer envelope (preview) */}
      {isPreview && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w, totalH, d]} />
          <meshBasicMaterial color="#2C5282" wireframe transparent opacity={0.45} />
        </mesh>
      )}

      {/* Hollow body outline (preview) */}
      {isPreview && (
        <group>
          {/* Back */}
          <mesh position={[0, bodyCenterY, d / 2 - wt / 2]}>
            <boxGeometry args={[w, dims.bodyH, wt]} />
            <meshBasicMaterial color="#2C5282" wireframe transparent opacity={0.4} />
          </mesh>
          {/* Left */}
          <mesh position={[-w / 2 + wt / 2, bodyCenterY, 0]}>
            <boxGeometry args={[wt, dims.bodyH, d]} />
            <meshBasicMaterial color="#2C5282" wireframe transparent opacity={0.4} />
          </mesh>
          {/* Right */}
          <mesh position={[w / 2 - wt / 2, bodyCenterY, 0]}>
            <boxGeometry args={[wt, dims.bodyH, d]} />
            <meshBasicMaterial color="#2C5282" wireframe transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      {/* Footer / base plinth — full outer footprint when depth is auto (0) */}
      {config.footer.enabled && dims.footerH > 0 && (
        <mesh
          position={[0, footerCenterY, footerZ]}
          {...bind}
        >
          <boxGeometry args={[footerSize.width, dims.footerH, footerSize.depth]} />
          <meshStandardMaterial
            color={config.footer.color}
            emissive={config.footer.emissive ?? config.footer.color}
            emissiveIntensity={isPreview ? 0.25 : 0.15}
            metalness={0.3}
            roughness={0.45}
          />
          <Edges color="#1a252f" lineWidth={1} />
        </mesh>
      )}

      {/* Corner posts (metal frame) — span body cavity, sit on footer */}
      {postPositions.map((pos, i) => (
        <mesh
          key={`post-${i}`}
          position={[pos[0], bottomY + dims.footerH + dims.bodyH / 2, pos[2]]}
          {...bind}
        >
          <boxGeometry args={[postR * 2, dims.bodyH, postR * 2]} />
          <meshStandardMaterial color={POST_COLOR} metalness={0.7} roughness={0.35} />
        </mesh>
      ))}

      {/* Back wall (one-sided) or center divider (two-sided) */}
      {config.walls.back && (
        <group position={[0, bodyCenterY, dividerZ]} {...bind}>
          <mesh>
            <boxGeometry args={[innerW + wt, dims.bodyH - wt * 0.5, wt]} />
            {wallMat}
            <Edges color={hovered ? '#2C5282' : '#95a5a6'} lineWidth={1} />
          </mesh>
          {/* Peg holes hint — both faces when double-sided */}
          {Array.from({ length: isDoubleSided ? 2 : 1 }, (_, face) =>
            Array.from({ length: 5 }, (_, row) =>
              Array.from({ length: 8 }, (_, col) => (
                <mesh
                  key={`peg-${face}-${row}-${col}`}
                  position={[
                    -innerW / 2 + (col + 0.5) * (innerW / 8),
                    -dims.bodyH / 2 + wt + (row + 1) * ((dims.bodyH - wt) / 6),
                    (face === 0 ? 1 : -1) * (wt / 2 + 0.002),
                  ]}
                >
                  <circleGeometry args={[0.012, 8]} />
                  <meshStandardMaterial color={PEG_COLOR} roughness={0.9} />
                </mesh>
              )),
            ),
          )}
        </group>
      )}

      {/* Left side wall */}
      {config.walls.left && (
        <mesh position={[-w / 2 + wt / 2, bodyCenterY, 0]} {...bind}>
          <boxGeometry args={[wt, dims.bodyH - wt * 0.5, d - wt]} />
          {wallMat}
          <Edges color={hovered ? '#2C5282' : '#bdc3c7'} lineWidth={1} />
        </mesh>
      )}

      {/* Right side wall */}
      {config.walls.right && (
        <mesh position={[w / 2 - wt / 2, bodyCenterY, 0]} {...bind}>
          <boxGeometry args={[wt, dims.bodyH - wt * 0.5, d - wt]} />
          {wallMat}
          <Edges color={hovered ? '#2C5282' : '#bdc3c7'} lineWidth={1} />
        </mesh>
      )}

      {/* Thin top rail */}
      <mesh position={[0, bodyTopY - wt / 4, cavityZ]} {...bind}>
        <boxGeometry args={[innerW, wt * 0.6, cavityDepth]} />
        <meshStandardMaterial color={POST_COLOR} metalness={0.65} roughness={0.4} />
      </mesh>

      {/* Inner floor (base of cavity) */}
      <mesh position={[0, bodyBottomY + wt / 4, cavityZ]} {...bind}>
        <boxGeometry args={[innerW, wt / 2, cavityDepth]} />
        <meshStandardMaterial color="#f4f6f8" roughness={0.85} metalness={0.1} />
      </mesh>

      {/* Header / fascia — flush on top, anchored to front face */}
      {config.header.enabled && dims.headerH > 0 && (
        <mesh position={[0, headerCenterY, headerZ]} {...bind}>
          <boxGeometry args={[headerSize.width, dims.headerH, headerSize.depth]} />
          <meshStandardMaterial
            color={config.header.color}
            emissive={config.header.emissive ?? config.header.color}
            emissiveIntensity={isPreview ? 0.35 : 0.18}
            metalness={0.2}
            roughness={0.45}
          />
          <Edges color="#1a252f" lineWidth={1.5} />
        </mesh>
      )}

      {/* Optional glass front */}
      {config.walls.frontGlass && (
        <group>
          <mesh position={[0, bodyCenterY, -d / 2 + wt / 2]} {...bind}>
            <boxGeometry args={[innerW, dims.bodyH * 0.92, 0.03]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={0.3}
              metalness={0.85}
              roughness={0.05}
            />
          </mesh>
          <mesh position={[0, bodyTopY - 0.04, -d / 2 + wt]}>
            <boxGeometry args={[innerW * 0.9, 0.025, 0.025]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )}
    </group>
  )
}
