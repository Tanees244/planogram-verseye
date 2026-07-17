'use client'

import { cn } from '@/lib/cn'
import { packFacingsInBin } from '@/utils/facingPack'

/** Front + top-down facing preview with depth packing and vertical stacks. */
export function FacingShelfPreview({
  binWidthM,
  binHeightM,
  binDepthM,
  facingWidthM,
  facingHeightM,
  facingDepthM,
  quantity,
  usedWidthM = 0,
  occupiedFacings = 0,
  className,
  label = 'Live facing preview',
}: {
  binWidthM: number
  binHeightM: number
  binDepthM?: number
  facingWidthM: number
  facingHeightM: number
  facingDepthM?: number
  quantity: number
  usedWidthM?: number
  occupiedFacings?: number
  className?: string
  label?: string
}) {
  if (!(binWidthM > 0 && binHeightM > 0 && facingWidthM > 0 && facingHeightM > 0)) {
    return null
  }

  const depthM = binDepthM && binDepthM > 0 ? binDepthM : binWidthM * 0.6
  const faceD = facingDepthM && facingDepthM > 0 ? facingDepthM : facingWidthM
  const qty = Math.max(0, Math.floor(quantity) || 0)
  const usedW = Math.max(0, Math.min(usedWidthM, binWidthM))

  const pack = packFacingsInBin({
    binWidth: binWidthM,
    binHeight: binHeightM,
    binDepth: depthM,
    facing: { width: facingWidthM, height: facingHeightM, depth: faceD },
    quantity: qty,
    usedWidthM: usedW,
    occupiedFacings,
    visualLimit: 1, // grid views use math; skip heavy slot list
  })

  const { cols, depthRows, stackLayers, maxFit } = pack
  const overflow = qty > maxFit
  const overflowCount = Math.max(0, qty - maxFit)
  const placedQty = Math.min(qty, maxFit)
  const footprint = Math.max(1, cols * depthRows)

  // Front elevation: front depth-row only, columns × stack layers
  const frontCells: boolean[][] = Array.from({ length: cols }, () =>
    Array.from({ length: stackLayers }, () => false),
  )
  for (let i = 0; i < placedQty; i++) {
    const layer = Math.floor(i / footprint)
    const rem = i % footprint
    const col = rem % cols
    const depthRow = Math.floor(rem / cols)
    if (depthRow === 0 && layer < stackLayers && col < cols) {
      frontCells[col][layer] = true
    }
  }

  // Top view: stack count per (col, depthRow) cell — darker = taller stack
  const topStacks: number[][] = Array.from({ length: cols }, () =>
    Array.from({ length: depthRows }, () => 0),
  )
  for (let i = 0; i < placedQty; i++) {
    const layer = Math.floor(i / footprint)
    const rem = i % footprint
    const col = rem % cols
    const depthRow = Math.floor(rem / cols)
    if (col < cols && depthRow < depthRows) {
      topStacks[col][depthRow] = Math.max(topStacks[col][depthRow], layer + 1)
    }
  }

  const cellW = 100 / Math.max(cols, 1)
  const cellD = 100 / Math.max(depthRows, 1)

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p
          className={cn(
            'text-[10px] font-medium tabular-nums',
            overflow ? 'text-red-600' : 'text-[#2C5282]',
          )}
        >
          {qty} facing{qty === 1 ? '' : 's'}
          {overflow
            ? ` · +${overflowCount} won’t fit`
            : ` · max ${maxFit} (${cols}×${depthRows}×${stackLayers})`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Front: columns across, stacks up (front depth row) */}
        <div className="space-y-1">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">
            Front (W × H stacks)
          </p>
          <div className="relative h-24 w-full rounded-lg border border-dashed border-gray-300 bg-white overflow-hidden p-1.5">
            <div className="absolute inset-1.5 rounded-sm bg-gray-100/80 border border-gray-200" />
            <div className="relative h-full w-full flex items-end">
              {frontCells.map((stackCol, col) => (
                  <div
                    key={`front-col-${col}`}
                    className="relative h-full flex flex-col-reverse justify-start gap-px box-border px-px"
                    style={{ width: `${cellW}%` }}
                  >
                    {Array.from({ length: stackLayers }, (_, layer) => {
                      const filled = stackCol[layer]
                      return (
                        <div
                          key={`f-${col}-${layer}`}
                          className={cn(
                            'w-full rounded-[1px] border',
                            filled
                              ? overflow
                                ? 'bg-red-500/80 border-red-600'
                                : 'bg-[#2C5282]/90 border-[#2C5282]'
                              : 'border-transparent',
                          )}
                          style={{
                            height: `${100 / stackLayers}%`,
                            minHeight: 2,
                            opacity: filled ? 1 : 0.08,
                            backgroundColor: filled
                              ? undefined
                              : 'rgba(148, 163, 184, 0.25)',
                          }}
                          title={
                            filled
                              ? `Col ${col + 1}, stack ${layer + 1}`
                              : `Empty stack ${layer + 1}`
                          }
                        />
                      )
                    })}
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top: footprint; shade by how many are stacked */}
        <div className="space-y-1">
          <p className="text-[9px] text-gray-500 uppercase tracking-wide">
            Top (W × D · shade = stacks)
          </p>
          <div className="relative h-24 w-full rounded-lg border border-dashed border-gray-300 bg-white overflow-hidden p-1.5">
            <div className="absolute inset-1.5 rounded-sm bg-gray-100 border border-gray-200" />
            <div className="relative h-full w-full">
              {topStacks.map((colStacks, col) =>
                colStacks.map((stacks, depthRow) => {
                  if (stacks <= 0) return null
                  const intensity = 0.35 + (stacks / Math.max(stackLayers, 1)) * 0.65
                  return (
                    <div
                      key={`top-${col}-${depthRow}`}
                      className={cn(
                        'absolute rounded-[1px] border flex items-center justify-center',
                        overflow ? 'border-red-600' : 'border-[#1e3a5f]/50',
                      )}
                      style={{
                        left: `${col * cellW}%`,
                        top: `${depthRow * cellD}%`,
                        width: `${cellW}%`,
                        height: `${cellD}%`,
                        backgroundColor: overflow
                          ? `rgba(239, 68, 68, ${intensity})`
                          : `rgba(44, 82, 130, ${intensity})`,
                        padding: 1,
                      }}
                      title={`${stacks} stacked`}
                    >
                      {stackLayers > 1 && stacks > 0 && (
                        <span className="text-[7px] font-semibold text-white/95 leading-none">
                          {stacks}
                        </span>
                      )}
                    </div>
                  )
                }),
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 leading-snug">
        Pack order: across → depth → stack up. Front shows the front row with stacks; top
        numbers show stack height per cell (
        {(facingWidthM * 100).toFixed(0)}×{(faceD * 100).toFixed(0)}×
        {(facingHeightM * 100).toFixed(0)} cm).
      </p>
    </div>
  )
}
