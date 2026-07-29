'use client'

import { SCENE_THEMES } from '@/constants/sceneTheme'
import {
  BUILDING_HEIGHT,
  BUILDING_WALL_MARGIN,
  BUILDING_WALL_THICKNESS,
  WAREHOUSE_SCALE,
} from '@/constants/warehouse'
import { BuildingExterior } from '@/components/scene/BuildingExterior'

interface StoreEnvironmentProps {
  halfW: number
  halfD: number
  width: number
  depth: number
}

const BUILDING_H = BUILDING_HEIGHT

/** Daytime retail lot: grass, plaza, landscaping + Almarai-style shell. */
export function StoreEnvironment({ halfW, halfD, width, depth }: StoreEnvironmentProps) {
  const cfg = SCENE_THEMES.day
  const S = WAREHOUSE_SCALE
  const pad = 28 * S
  const groundW = width + pad * 2
  const groundD = depth + pad * 2

  const treeSpots: [number, number, number][] = [
    [-halfW - 8, 0, halfD + 10],
    [-halfW - 11, 0, halfD + 6],
    [-halfW - 6, 0, halfD + 14],
    [halfW + 9, 0, halfD + 9],
    [halfW + 12, 0, halfD + 5],
    [halfW + 7, 0, halfD + 13],
  ]

  // Interior slab runs under the walls so the floor meets them with no gap.
  const interiorW = width + (BUILDING_WALL_MARGIN + BUILDING_WALL_THICKNESS) * 2
  const interiorD = depth + (BUILDING_WALL_MARGIN + BUILDING_WALL_THICKNESS) * 2

  return (
    <group>
      {/* Deep lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[groundW + 48, groundD + 48]} />
        <meshStandardMaterial color="#3d8f4a" roughness={0.95} />
      </mesh>

      {/* Lighter lawn ring near plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, halfD + 16]} receiveShadow>
        <planeGeometry args={[width + 36, 14]} />
        <meshStandardMaterial color="#58a85f" roughness={0.9} />
      </mesh>

      {/* Concrete plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, halfD + 7]} receiveShadow>
        <planeGeometry args={[width + 24, 20]} />
        <meshStandardMaterial color="#c5ccd6" roughness={0.78} metalness={0.04} />
      </mesh>

      {/* Plaza tile joints */}
      {Array.from({ length: 11 }, (_, i) => i - 5).map((i) => (
        <mesh key={`px-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[i * 2.2, 0.008, halfD + 7]}>
          <planeGeometry args={[0.05, 20]} />
          <meshStandardMaterial color="#9aa3b0" />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => i - 3.5).map((i) => (
        <mesh key={`pz-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, halfD + 7 + i * 2.4]}>
          <planeGeometry args={[width + 24, 0.045]} />
          <meshStandardMaterial color="#9aa3b0" />
        </mesh>
      ))}

      {/* Drive aisle asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.028, -halfD * 0.35]} receiveShadow>
        <planeGeometry args={[groundW, groundD * 0.7]} />
        <meshStandardMaterial color={cfg.asphaltColor} roughness={0.88} metalness={0.06} />
      </mesh>

      {/* Center dashed lane marking */}
      {Array.from({ length: 14 }, (_, i) => i - 7).map((i) => (
        <mesh
          key={`lane-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[i * 2.4, -0.01, -halfD * 0.35]}
        >
          <planeGeometry args={[1.1, 0.18]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}

      {/* Front curb zebra */}
      {Array.from({ length: 14 }, (_, i) => i - 7).map((i) => (
        <mesh
          key={`curb-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[i * 1.65, 0.012, halfD + 16.5]}
        >
          <planeGeometry args={[0.75, 0.4]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#f1c40f' : '#111827'} />
        </mesh>
      ))}

      {/* Planter boxes */}
      {(
        [
          [-halfW - 3.5, halfD + 12],
          [halfW + 3.5, halfD + 12],
          [-halfW - 5, halfD + 8],
          [halfW + 5, halfD + 8],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <group key={`planter-${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.28, 0]} castShadow>
            <boxGeometry args={[1.6, 0.55, 1.6]} />
            <meshStandardMaterial color="#8b7355" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.85, 0]} castShadow>
            <sphereGeometry args={[0.55 + (i % 2) * 0.12, 12, 12]} />
            <meshStandardMaterial color="#2f8f3a" roughness={0.88} />
          </mesh>
        </group>
      ))}

      {/* Tree cluster */}
      {treeSpots.map(([x, , z], i) => (
        <group key={`tree-${i}`} position={[x, 0, z]} scale={0.85 + (i % 3) * 0.12}>
          <mesh position={[0, 1.35, 0]}>
            <cylinderGeometry args={[0.14, 0.22, 2.7, 8]} />
            <meshStandardMaterial color="#6b4226" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <sphereGeometry args={[1.25, 12, 12]} />
            <meshStandardMaterial color="#3f9e48" roughness={0.8} />
          </mesh>
          <mesh position={[0.55, 2.7, 0.3]}>
            <sphereGeometry args={[0.7, 10, 10]} />
            <meshStandardMaterial color="#4db356" roughness={0.82} />
          </mesh>
        </group>
      ))}

      {/* Store interior slab — perimeter walkway between sales floor and walls */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.005, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[interiorW, interiorD]} />
        <meshStandardMaterial color="#dbe2ec" roughness={0.7} metalness={0.05} />
      </mesh>

      <BuildingExterior halfW={halfW} halfD={halfD} width={width} depth={depth} />

      {/* Soft interior fill */}
      <pointLight
        position={[0, BUILDING_H - 1.2, 0]}
        intensity={0.45}
        distance={width * 1.7}
        color="#fff8ef"
        decay={2}
      />
      <pointLight
        position={[0, 5.5, halfD * 0.2]}
        intensity={0.28}
        distance={width}
        color="#e8f1ff"
        decay={2}
      />

      {/* Sales-floor perimeter frame only (not a solid slab — that hid the grid) */}
      {(
        [
          [0, 0.06, halfD + 0.12, width + 0.35, 0.12, 0.24],
          [0, 0.06, -halfD - 0.12, width + 0.35, 0.12, 0.24],
          [halfW + 0.12, 0.06, 0, 0.24, 0.12, depth + 0.35],
          [-halfW - 0.12, 0.06, 0, 0.24, 0.12, depth + 0.35],
        ] as [number, number, number, number, number, number][]
      ).map(([x, y, z, w, h, d], i) => (
        <mesh key={`floor-edge-${i}`} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.65} metalness={0.08} />
        </mesh>
      ))}
    </group>
  )
}
