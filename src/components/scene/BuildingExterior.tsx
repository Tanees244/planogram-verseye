'use client'

import { useState, Suspense, useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { usePlanogramStore } from '@/store/planogramStore'
import { SCENE_THEMES } from '@/constants/sceneTheme'
import { WAREHOUSE_SCALE, BUILDING_HEIGHT } from '@/constants/warehouse'

interface BuildingExteriorProps {
  halfW: number
  halfD: number
  width: number
  depth: number
}

/** Almarai logo on entrance sign — mesh texture (no Html; avoids UI z-index punch-through). */
function StoreSign({ position }: { position: [number, number, number] }) {
  const texture = useLoader(TextureLoader, '/store-logo.png') as Texture
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])

  const S = WAREHOUSE_SCALE
  const signW = 6.2 * S
  const signH = 3.4 * S

  return (
    <mesh position={position} raycast={() => null}>
      <planeGeometry args={[signW, signH]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

/** Almarai-style warehouse shell — click roof to open for interior editing. */
export function BuildingExterior({ halfW, halfD, width, depth }: BuildingExteriorProps) {
  const roofVisible = usePlanogramStore((s) => s.roofVisible)
  const setRoofVisible = usePlanogramStore((s) => s.setRoofVisible)
  const cfg = SCENE_THEMES.day

  const [roofHovered, setRoofHovered] = useState(false)

  const S = WAREHOUSE_SCALE
  const margin = 2.5 * S
  const bW = width + margin * 2
  const bD = depth + margin * 2
  const floor1H = 4.5 * S
  const floor2H = 3.5 * S
  const totalH = floor1H + floor2H
  const wallT = 0.45 * S
  const white = '#f5f7fa'
  const glass = '#6ba3d4'
  const glassEmissive = '#000000'
  const roofColor = '#e8ecef'

  const removeRoof = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setRoofVisible(false)
  }

  return (
    <group>
      {/* ── Main building shell ── */}
      {/* Ground floor – back wall (-Z) */}
      <mesh position={[0, floor1H / 2, -halfD - margin - wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[bW, floor1H, wallT]} />
        <meshStandardMaterial color={white} roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Ground floor – side walls */}
      {[-1, 1].map((side) => (
        <mesh
          key={`gf-side-${side}`}
          position={[side * (halfW + margin + wallT / 2), floor1H / 2, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallT, floor1H, bD]} />
          <meshStandardMaterial color={white} roughness={0.55} metalness={0.05} />
        </mesh>
      ))}

      {/* Ground floor – front wall (+Z) with entrance opening */}
      {/* Left panel */}
      <mesh position={[-bW * 0.32, floor1H / 2, halfD + margin + wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[bW * 0.32, floor1H, wallT]} />
        <meshStandardMaterial color={white} roughness={0.55} />
      </mesh>
      {/* Right panel */}
      <mesh position={[bW * 0.32, floor1H / 2, halfD + margin + wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[bW * 0.32, floor1H, wallT]} />
        <meshStandardMaterial color={white} roughness={0.55} />
      </mesh>
      {/* Header above entrance */}
      <mesh position={[0, floor1H - 0.5 * S, halfD + margin + wallT / 2]} castShadow receiveShadow>
        <boxGeometry args={[bW * 0.36, 1 * S, wallT]} />
        <meshStandardMaterial color={white} roughness={0.5} />
      </mesh>

      {/* Glass entrance doors */}
      <mesh position={[0, floor1H * 0.38, halfD + margin + wallT + 0.04]}>
        <boxGeometry args={[bW * 0.28, floor1H * 0.65, 0.08]} />
        <meshStandardMaterial
          color={glass}
          emissive={glassEmissive}
          emissiveIntensity={0.05}
          transparent
          opacity={0.65}
          metalness={0.3}
          roughness={0.1}
        />
      </mesh>

      {/* Sign volume above entrance (protruding block) */}
      <mesh position={[0, floor1H + floor2H * 0.55, halfD + margin + 1.4 * S]} castShadow>
        <boxGeometry args={[9 * S, 4 * S, 2.4 * S]} />
        <meshStandardMaterial color={white} roughness={0.4} metalness={0.08} />
      </mesh>
      <Suspense fallback={null}>
        <StoreSign position={[0, floor1H + floor2H * 0.55, halfD + margin + 2.62 * S]} />
      </Suspense>

      {/* Upper floor – continuous glass band on all sides */}
      {[
        { pos: [0, floor1H + floor2H / 2, -halfD - margin - wallT - 0.04] as [number, number, number], size: [bW, floor2H * 0.75, 0.1] as [number, number, number] },
        { pos: [0, floor1H + floor2H / 2, halfD + margin + wallT + 0.04] as [number, number, number], size: [bW, floor2H * 0.75, 0.1] as [number, number, number] },
        ...([-1, 1] as const).map((side) => ({
          pos: [side * (halfW + margin + wallT + 0.04), floor1H + floor2H / 2, 0] as [number, number, number],
          size: [0.1, floor2H * 0.75, bD] as [number, number, number],
        })),
      ].map((w, i) => (
        <mesh key={`glass-band-${i}`} position={w.pos}>
          <boxGeometry args={w.size} />
          <meshStandardMaterial
            color={glass}
            emissive={glassEmissive}
            emissiveIntensity={0.04}
            transparent
            opacity={0.55}
            metalness={0.4}
            roughness={0.05}
          />
        </mesh>
      ))}

      {/* Upper floor solid spandrel panels (top/bottom of glass band) */}
      {[-1, 1].map((side) => (
        <mesh key={`spandrel-${side}`} position={[side * (halfW + margin + wallT / 2), floor1H + floor2H - 0.3, 0]}>
          <boxGeometry args={[wallT, 0.6, bD]} />
          <meshStandardMaterial color={white} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, floor1H + floor2H - 0.3, -halfD - margin - wallT / 2]}>
        <boxGeometry args={[bW, 0.6, wallT]} />
        <meshStandardMaterial color={white} roughness={0.55} />
      </mesh>

      {/* Left annex wing (taller set-back section) */}
      <group position={[-halfW - margin - 6 * S, 0, -halfD - margin + 4 * S]}>
        <mesh position={[0, 5.5 * S, 0]} castShadow receiveShadow>
          <boxGeometry args={[7 * S, 11 * S, 10 * S]} />
          <meshStandardMaterial color={white} roughness={0.55} metalness={0.05} />
        </mesh>
        {[2, 5, 8].map((y) => (
          <mesh key={`annex-win-${y}`} position={[3.55 * S, y * S, 0]}>
            <boxGeometry args={[0.08 * S, 1.4 * S, 6 * S]} />
            <meshStandardMaterial
              color={glass}
              emissive={glassEmissive}
              emissiveIntensity={0.03}
              transparent
              opacity={0.5}
            />
          </mesh>
        ))}
      </group>

      {/* Small front-left utility box */}
      <mesh position={[-halfW - margin - 2 * S, 1.2 * S, halfD + margin + 3 * S]} castShadow>
        <boxGeometry args={[4 * S, 2.4 * S, 3.5 * S]} />
        <meshStandardMaterial color={white} roughness={0.6} />
      </mesh>

      {/* Entrance canopy */}
      <mesh position={[0, floor1H - 0.2 * S, halfD + margin + 2.5 * S]}>
        <boxGeometry args={[bW * 0.45, 0.2 * S, 3.5 * S]} />
        <meshStandardMaterial color={cfg.accentColor} roughness={0.35} metalness={0.25} />
      </mesh>

      {/* ── Clickable roof ── */}
      {roofVisible && (
        <group>
          <mesh
            position={[0, totalH + 0.18, 0]}
            castShadow
            receiveShadow
            onClick={removeRoof}
            onPointerOver={(e) => {
              e.stopPropagation()
              setRoofHovered(true)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              setRoofHovered(false)
              document.body.style.cursor = 'default'
            }}
          >
            <boxGeometry args={[bW + 1.5 * S, 0.35 * S, bD + 1.5 * S]} />
            <meshStandardMaterial
              color={roofHovered ? '#d0e4f7' : roofColor}
              emissive={roofHovered ? '#2C5282' : '#000000'}
              emissiveIntensity={roofHovered ? 0.25 : 0}
              roughness={0.45}
              metalness={0.15}
            />
          </mesh>
          {/* Roof edge parapet */}
          <mesh position={[0, totalH + 0.42 * S, 0]}>
            <boxGeometry args={[bW + 1.6 * S, 0.12 * S, bD + 1.6 * S]} />
            <meshStandardMaterial color={white} roughness={0.5} />
          </mesh>
        </group>
      )}

      {/* Interior parapet walls when roof is off (low rim) */}
      {!roofVisible && (
        <>
          <mesh position={[0, totalH, -halfD - margin - wallT / 2]}>
            <boxGeometry args={[bW, 0.25, wallT]} />
            <meshStandardMaterial color={white} roughness={0.55} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={`parapet-${side}`} position={[side * (halfW + margin + wallT / 2), totalH, 0]}>
              <boxGeometry args={[wallT, 0.25, bD]} />
              <meshStandardMaterial color={white} roughness={0.55} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}
