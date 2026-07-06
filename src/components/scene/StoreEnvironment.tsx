'use client'

import { usePlanogramStore } from '@/store/planogramStore'
import { SCENE_THEMES } from '@/constants/sceneTheme'
import { BUILDING_HEIGHT, WAREHOUSE_SCALE } from '@/constants/warehouse'
import { BuildingExterior } from '@/components/scene/BuildingExterior'

interface StoreEnvironmentProps {
  halfW: number
  halfD: number
  width: number
  depth: number
}

const BUILDING_H = BUILDING_HEIGHT

/** Paved forecourt, landscaping, interior lights + Almarai-style building shell. */
export function StoreEnvironment({ halfW, halfD, width, depth }: StoreEnvironmentProps) {
  const theme = usePlanogramStore((s) => s.sceneTheme)
  const roofVisible = usePlanogramStore((s) => s.roofVisible)
  const cfg = SCENE_THEMES[theme]
  const isNight = theme === 'night'

  const S = WAREHOUSE_SCALE
  const pad = 28 * S
  const groundW = width + pad * 2
  const groundD = depth + pad * 2

  const lampPositions: [number, number][] = [
    [-halfW - 8, halfD + 10],
    [halfW + 8, halfD + 10],
    [-halfW - 8, -halfD - 8],
    [halfW + 8, -halfD - 8],
    [-halfW, halfD + 14],
    [0, halfD + 14],
    [halfW, halfD + 14],
    [-halfW - 4, halfD + 6],
    [halfW + 4, halfD + 6],
  ]

  const entranceLights: [number, number, number][] = [
    [-4, 6, halfD + 8],
    [4, 6, halfD + 8],
    [0, 7, halfD + 10],
  ]

  return (
    <group>
      {/* Grass beyond paving */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[groundW + 40, groundD + 40]} />
        <meshStandardMaterial color={isNight ? '#2a4a2a' : '#5a8f5a'} roughness={0.95} />
      </mesh>

      {/* Paved forecourt (interlocking stone look) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, halfD + 6]} receiveShadow>
        <planeGeometry args={[width + 20, 18]} />
        <meshStandardMaterial color={isNight ? '#5a5e64' : '#9aa0a8'} roughness={0.88} />
      </mesh>
      {/* Paver grid lines */}
      {Array.from({ length: 8 }, (_, i) => i - 4).map((i) => (
        <mesh key={`paver-x-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[i * 2.5, 0.005, halfD + 6]}>
          <planeGeometry args={[0.04, 18]} />
          <meshStandardMaterial color={isNight ? '#4a4e54' : '#8a9098'} />
        </mesh>
      ))}

      {/* Main asphalt / lot behind building */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -halfD / 2]} receiveShadow>
        <planeGeometry args={[groundW, groundD * 0.6]} />
        <meshStandardMaterial color={cfg.asphaltColor} roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Yellow / black curb stripes (front) */}
      {Array.from({ length: 12 }, (_, i) => i - 6).map((i) => (
        <mesh
          key={`curb-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[i * 1.8, 0.01, halfD + 14]}
        >
          <planeGeometry args={[0.85, 0.35]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#f1c40f' : '#1a1a1a'} />
        </mesh>
      ))}

      {/* Landscaping bushes */}
      {(
        [
          [-halfW - 4, halfD + 12],
          [halfW + 3, halfD + 11],
          [-halfW - 6, halfD + 8],
          [halfW + 6, halfD + 9],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <mesh key={`bush-${i}`} position={[x, 0.5, z]} castShadow>
          <sphereGeometry args={[0.7 + (i % 2) * 0.2, 10, 10]} />
          <meshStandardMaterial color={isNight ? '#1e5a1e' : '#3d8b3d'} roughness={0.9} />
        </mesh>
      ))}

      {/* Small tree */}
      <group position={[halfW + 10, 0, halfD + 8]}>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.12, 0.18, 2.4, 8]} />
          <meshStandardMaterial color="#6b4226" roughness={0.9} />
        </mesh>
        <mesh position={[0, 3, 0]}>
          <sphereGeometry args={[1.1, 10, 10]} />
          <meshStandardMaterial color={isNight ? '#1e5a1e' : '#4a9a4a'} roughness={0.85} />
        </mesh>
      </group>

      {/* Almarai-style building */}
      <BuildingExterior halfW={halfW} halfD={halfD} width={width} depth={depth} />

      {/* Interior ceiling lights at night (always on — glow through windows / open roof) */}
      {isNight &&
        (() => {
          const cols = roofVisible ? 4 : 5
          const rows = roofVisible ? 4 : 5
          const lights: [number, number][] = []
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const x = -width * 0.4 + (c / (cols - 1)) * width * 0.8
              const z = -depth * 0.4 + (r / (rows - 1)) * depth * 0.8
              lights.push([x, z])
            }
          }
          const intensity = roofVisible ? cfg.ceilingLightIntensity * 0.45 : cfg.ceilingLightIntensity
          return lights.map(([x, z], i) => (
            <group key={`ceil-${i}`} position={[x, BUILDING_H - 0.4, z]}>
              {!roofVisible && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.45, 16]} />
                  <meshStandardMaterial color="#fffef5" emissive="#fff8e0" emissiveIntensity={2.5} />
                </mesh>
              )}
              <pointLight intensity={intensity} distance={width * 1.4} color="#fff4d6" decay={1} />
            </group>
          ))
        })()}

      {isNight && (
        <>
          <pointLight position={[0, BUILDING_H - 0.5, 0]} intensity={3} distance={width * 2} color="#dce4f4" decay={1} />
          <pointLight position={[0, 4, halfD + 6]} intensity={4} distance={35} color="#ffe8c0" decay={1} />
        </>
      )}

      {/* Entrance flood lights */}
      {isNight &&
        entranceLights.map(([x, y, z], i) => (
          <group key={`entrance-${i}`} position={[x, y, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.25, 12]} />
              <meshStandardMaterial color="#fff8e0" emissive="#ffb347" emissiveIntensity={3} />
            </mesh>
            <pointLight intensity={5} distance={35} color="#ffe8c8" decay={1} />
            <pointLight position={[0, -2, 2]} intensity={2.5} distance={22} color="#ffd699" decay={1} />
          </group>
        ))}

      {/* Street lamps */}
      {isNight &&
        lampPositions.map(([x, z], i) => (
          <group key={`lamp-${i}`} position={[x, 0, z]}>
            <mesh position={[0, 3, 0]}>
              <cylinderGeometry args={[0.1, 0.12, 6, 8]} />
              <meshStandardMaterial color="#3a3f47" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 6.2, 0]}>
              <sphereGeometry args={[0.25, 12, 12]} />
              <meshStandardMaterial color="#ffe082" emissive="#ffb300" emissiveIntensity={2} />
            </mesh>
            <pointLight position={[0, 6, 0]} intensity={cfg.streetLightIntensity} distance={55} color="#ffd699" decay={1} />
            <pointLight position={[0, 3, 0]} intensity={cfg.streetLightIntensity * 0.4} distance={25} color="#ffe082" decay={1} />
          </group>
        ))}

      {/* Sales floor curb */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[width + 0.3, 0.12, depth + 0.3]} />
        <meshStandardMaterial color={isNight ? '#525860' : '#d1d5db'} roughness={0.8} />
      </mesh>
    </group>
  )
}
