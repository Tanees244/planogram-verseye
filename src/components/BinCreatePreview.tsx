'use client'

import { Canvas } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import { cn } from '@/lib/cn'

function RowScene({
  rowW,
  rowD,
  rowH,
  binW,
  binD,
  binH,
  occupied,
  overflow,
}: {
  rowW: number
  rowD: number
  rowH: number
  binW: number
  binD: number
  binH: number
  occupied: number
  overflow: boolean
}) {
  const shelfThick = 0.04
  const maxDim = Math.max(rowW, rowD, rowH, 0.3)
  // New bin sits right after the occupied strip, front-aligned
  const binX = -rowW / 2 + occupied + binW / 2
  const binY = -rowH / 2 + shelfThick + binH / 2
  const binZ = -rowD / 2 + binD / 2

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 2]} intensity={0.85} />

      {/* Row cavity (transparent) */}
      <mesh>
        <boxGeometry args={[rowW, rowH, rowD]} />
        <meshStandardMaterial color="#e8eef5" transparent opacity={0.15} />
        <Edges color="#64748b" />
      </mesh>

      {/* Shelf floor */}
      <mesh position={[0, -rowH / 2 + shelfThick / 2, 0]}>
        <boxGeometry args={[rowW, shelfThick, rowD]} />
        <meshStandardMaterial color="#cbd5e1" />
        <Edges color="#94a3b8" />
      </mesh>

      {/* Back wall hint */}
      <mesh position={[0, 0, rowD / 2 - 0.005]}>
        <boxGeometry args={[rowW, rowH, 0.01]} />
        <meshStandardMaterial color="#dbe4ee" transparent opacity={0.5} />
      </mesh>

      {/* Existing bins (occupied width) */}
      {occupied > 0.002 && (
        <mesh position={[-rowW / 2 + occupied / 2, -rowH / 2 + shelfThick + (rowH * 0.8) / 2, 0]}>
          <boxGeometry args={[occupied, rowH * 0.8, rowD * 0.9]} />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
          <Edges color="#64748b" />
        </mesh>
      )}

      {/* New bin */}
      <mesh position={[binX, binY, binZ]}>
        <boxGeometry args={[binW, binH, binD]} />
        <meshStandardMaterial
          color={overflow ? '#ef4444' : '#2C5282'}
          transparent
          opacity={0.65}
        />
        <Edges color={overflow ? '#b91c1c' : '#1e3a5f'} lineWidth={2} />
      </mesh>

      <OrbitControls
        enablePan={false}
        minDistance={maxDim * 1.1}
        maxDistance={maxDim * 4}
        target={[0, 0, 0]}
      />
    </>
  )
}

/** Orbitable 3D preview of the new bin sitting on the selected row. */
export function BinCreatePreview({
  rowWidthM,
  rowDepthM,
  rowHeightM,
  binWidthM,
  binDepthM,
  binHeightM,
  occupiedWidthM = 0,
  className,
}: {
  rowWidthM: number
  rowDepthM: number
  rowHeightM: number
  binWidthM: number
  binDepthM: number
  binHeightM: number
  occupiedWidthM?: number
  className?: string
}) {
  const rowW = Math.max(rowWidthM, 0.1)
  const rowD = Math.max(rowDepthM, 0.1)
  const rowH = Math.max(rowHeightM, 0.1)
  const occupied = Math.max(0, Math.min(occupiedWidthM, rowW))
  const free = Math.max(0, rowW - occupied)

  const overflowsW = binWidthM > free + 0.001
  const overflowsD = binDepthM > rowD + 0.001
  const overflowsH = binHeightM > rowH + 0.001
  const overflow = overflowsW || overflowsD || overflowsH

  // Clamp drawn size so the ghost stays visible inside the scene even when too big
  const binW = Math.min(Math.max(binWidthM, 0.05), free > 0.05 ? free : rowW)
  const binD = Math.min(Math.max(binDepthM, 0.05), rowD)
  const binH = Math.min(Math.max(binHeightM, 0.05), rowH * 0.96)

  const overflowNote = [
    overflowsW && 'width exceeds free row space',
    overflowsD && 'depth exceeds row',
    overflowsH && 'height exceeds row',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Live bin preview on row
        </p>
        <p
          className={cn(
            'text-[10px] font-medium tabular-nums',
            overflow ? 'text-red-600' : 'text-[#2C5282]',
          )}
        >
          {(binWidthM * 100).toFixed(0)}×{(binDepthM * 100).toFixed(0)}×
          {(binHeightM * 100).toFixed(0)} cm
          {overflow ? ' · exceeds row' : ''}
        </p>
      </div>

      <div className="h-48 w-full rounded-lg border border-dashed border-gray-300 bg-white overflow-hidden">
        <Canvas
          camera={{
            position: [rowW * 0.9, rowH * 1.1, -rowD * 2.2],
            fov: 42,
            near: 0.01,
            far: 60,
          }}
          dpr={[1, 1.5]}
        >
          <RowScene
            rowW={rowW}
            rowD={rowD}
            rowH={rowH}
            binW={binW}
            binD={binD}
            binH={binH}
            occupied={occupied}
            overflow={overflow}
          />
        </Canvas>
      </div>

      {overflow ? (
        <p className="text-[10px] font-medium text-red-600 leading-snug">{overflowNote}</p>
      ) : (
        <p className="text-[10px] text-gray-500 leading-snug">
          Blue box = new bin · gray = existing bins. Drag to orbit. The same ghost appears on the
          selected row in the scene.
        </p>
      )}
    </div>
  )
}
