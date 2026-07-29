'use client'

import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { Html } from '@react-three/drei'
import { FLOOR_GRID_SIZE_M } from '@/utils/rackPlacement'
import { formatCmPair } from '@/utils/lengthUnits'

/**
 * Floor snap grid — only while placing / dragging / moving a fixture.
 * Shows fixture footprint dimensions on the floor.
 */
export function PlacementGrid({
  width,
  depth,
  mode = 'off',
  fixtureWidth,
  fixtureDepth,
  fixtureLabel,
}: {
  width: number
  depth: number
  mode?: 'off' | 'ambient' | 'active'
  fixtureWidth?: number | null
  fixtureDepth?: number | null
  fixtureLabel?: string | null
}) {
  const bars = useMemo(() => {
    if (mode === 'off' || !(width > 0) || !(depth > 0)) return null

    const step = FLOOR_GRID_SIZE_M
    const halfW = width / 2
    const halfD = depth / 2
    const y = 0.055
    const thick = 0.04
    const h = 0.014
    const nodes: React.ReactNode[] = []
    let i = 0

    nodes.push(
      <mesh key="tint" position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color="#1d4ed8" transparent opacity={0.14} depthWrite={false} side={DoubleSide} />
      </mesh>,
    )

    for (let x = -halfW; x <= halfW + 1e-6; x += step) {
      const major = Math.abs(x) < 1e-6 || Math.abs(Math.round(x / step) % 4) < 1e-6
      nodes.push(
        <mesh key={`gx-${i++}`} position={[x, y, 0]} raycast={() => null}>
          <boxGeometry args={[major ? thick * 1.35 : thick, h, depth]} />
          <meshBasicMaterial color={major ? '#1d4ed8' : '#60a5fa'} />
        </mesh>,
      )
    }
    for (let z = -halfD; z <= halfD + 1e-6; z += step) {
      const major = Math.abs(z) < 1e-6 || Math.abs(Math.round(z / step) % 4) < 1e-6
      nodes.push(
        <mesh key={`gz-${i++}`} position={[0, y, z]} raycast={() => null}>
          <boxGeometry args={[width, h, major ? thick * 1.35 : thick]} />
          <meshBasicMaterial color={major ? '#1d4ed8' : '#60a5fa'} />
        </mesh>,
      )
    }

    return nodes
  }, [width, depth, mode])

  if (!bars) return null

  const hasDims =
    fixtureWidth != null &&
    fixtureDepth != null &&
    Number.isFinite(fixtureWidth) &&
    Number.isFinite(fixtureDepth) &&
    fixtureWidth > 0 &&
    fixtureDepth > 0

  return (
    <group>
      {bars}
      {hasDims && (
        <>
          {/* Footprint outline at origin for size reference */}
          <mesh position={[0, 0.06, 0]} raycast={() => null}>
            <boxGeometry args={[fixtureWidth!, 0.02, fixtureDepth!]} />
            <meshBasicMaterial color="#2563eb" transparent opacity={0.2} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.07, 0]} raycast={() => null}>
            <boxGeometry args={[fixtureWidth! + 0.02, 0.01, fixtureDepth! + 0.02]} />
            <meshBasicMaterial color="#1e40af" wireframe />
          </mesh>
          <Html position={[0, 0.35, 0]} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.92)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid rgba(96,165,250,0.5)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                whiteSpace: 'nowrap',
                textAlign: 'center',
              }}
            >
              {fixtureLabel ? `${fixtureLabel} · ` : ''}
              {formatCmPair(fixtureWidth!, fixtureDepth!)}
              <div style={{ fontSize: 10, fontWeight: 500, color: '#93c5fd', marginTop: 2 }}>
                Grid {FLOOR_GRID_SIZE_M * 100}cm · snap to cells
              </div>
            </div>
          </Html>
        </>
      )}
    </group>
  )
}
