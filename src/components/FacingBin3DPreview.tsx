'use client'

import { Canvas } from '@react-three/fiber'
import { Edges, Instance, Instances, OrbitControls } from '@react-three/drei'
import { packFacingsInBin } from '@/utils/facingPack'
import { cn } from '@/lib/cn'
import { SAFE_GL_ALPHA } from '@/utils/webgl'

/** Instanced boxes are cheap — render every slot so a full bin looks full. */
const PREVIEW_SLOT_LIMIT = 5000

function BinScene({
  binWidthM,
  binHeightM,
  binDepthM,
  facingWidthM,
  facingHeightM,
  facingDepthM,
  quantity,
  usedWidthM,
  occupiedFacings,
  fits,
  packOrder = 'depthFirst',
}: {
  binWidthM: number
  binHeightM: number
  binDepthM: number
  facingWidthM: number
  facingHeightM: number
  facingDepthM: number
  quantity: number
  usedWidthM: number
  occupiedFacings: number
  fits: boolean
  packOrder?: 'depthFirst' | 'stackFirst'
}) {
  const pack = packFacingsInBin({
    binWidth: binWidthM,
    binHeight: binHeightM,
    binDepth: binDepthM,
    facing: { width: facingWidthM, height: facingHeightM, depth: facingDepthM },
    quantity,
    usedWidthM,
    occupiedFacings,
    visualLimit: PREVIEW_SLOT_LIMIT,
    packOrder,
  })

  const maxDim = Math.max(binWidthM, binHeightM, binDepthM, 0.2)

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[2, 3, 2]} intensity={0.9} />
      <group>
        <mesh>
          <boxGeometry args={[binWidthM, binHeightM, binDepthM]} />
          <meshStandardMaterial color="#e8eef5" transparent opacity={0.25} />
          <Edges color="#64748b" />
        </mesh>
        <mesh position={[0, -binHeightM / 2 + 0.005, 0]}>
          <boxGeometry args={[binWidthM * 0.98, 0.01, binDepthM * 0.98]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        {pack.slots.length > 0 && (
          <Instances key={pack.slots.length} limit={pack.slots.length}>
            <boxGeometry />
            <meshStandardMaterial transparent opacity={0.92} roughness={0.55} />
            {pack.slots.map((slot) => (
              <Instance
                key={slot.index}
                position={[slot.x, slot.y, slot.z]}
                scale={[slot.width, slot.height, slot.depth]}
                color={slot.overflow || !fits ? '#ef4444' : '#2C5282'}
              />
            ))}
          </Instances>
        )}
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={maxDim * 1.2}
        maxDistance={maxDim * 4}
        target={[0, 0, 0]}
      />
    </>
  )
}

/** Orbitable 3D preview of facings packed across width and into depth. */
export function FacingBin3DPreview({
  binWidthM,
  binHeightM,
  binDepthM,
  facingWidthM,
  facingHeightM,
  facingDepthM,
  quantity,
  usedWidthM = 0,
  occupiedFacings = 0,
  packOrder = 'depthFirst',
  className,
  label = '3D bin preview',
}: {
  binWidthM: number
  binHeightM: number
  binDepthM: number
  facingWidthM: number
  facingHeightM: number
  facingDepthM: number
  quantity: number
  usedWidthM?: number
  occupiedFacings?: number
  packOrder?: 'depthFirst' | 'stackFirst'
  className?: string
  label?: string
}) {
  if (
    !(binWidthM > 0 && binHeightM > 0 && binDepthM > 0) ||
    !(facingWidthM > 0 && facingHeightM > 0 && facingDepthM > 0)
  ) {
    return null
  }

  const pack = packFacingsInBin({
    binWidth: binWidthM,
    binHeight: binHeightM,
    binDepth: binDepthM,
    facing: { width: facingWidthM, height: facingHeightM, depth: facingDepthM },
    quantity: Math.max(0, Math.floor(quantity) || 0),
    usedWidthM,
    occupiedFacings,
    // Header only needs grid math (cols × rows × layers) — skip slot building.
    visualLimit: 0,
    packOrder,
  })
  const qty = Math.max(0, Math.floor(quantity) || 0)
  const overflow = qty > pack.maxFit

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p
          className={cn(
            'text-[10px] font-medium tabular-nums',
            overflow ? 'text-red-600' : 'text-[#2C5282]',
          )}
        >
          {pack.cols}×{pack.depthRows}×{pack.stackLayers} · max {pack.maxFit}
          {overflow ? ` · +${qty - pack.maxFit} over` : ''}
        </p>
      </div>
      <div className="h-44 w-full rounded-lg border border-dashed border-gray-300 bg-white overflow-hidden">
        <Canvas
          camera={{
            position: [binWidthM * 1.4, binHeightM * 1.6, binDepthM * 2.2],
            fov: 42,
            near: 0.01,
            far: 50,
          }}
          dpr={[1, 1]}
          gl={SAFE_GL_ALPHA}
        >
          <BinScene
            binWidthM={binWidthM}
            binHeightM={binHeightM}
            binDepthM={binDepthM}
            facingWidthM={facingWidthM}
            facingHeightM={facingHeightM}
            facingDepthM={facingDepthM}
            quantity={qty}
            usedWidthM={usedWidthM}
            occupiedFacings={occupiedFacings}
            fits={!overflow}
            packOrder={packOrder}
          />
        </Canvas>
      </div>
      <p className="text-[10px] text-gray-500 leading-snug">
        {packOrder === 'stackFirst'
          ? 'Stackable: fill across, then stack up on the front face, then depth. Drag to orbit.'
          : 'Facings fill left→right, then front→back, then stack up. Drag to orbit.'}
      </p>
    </div>
  )
}
