'use client'

/**
 * Floor-coordinate diagnostics for rack placement.
 *
 * Shows, per rack, the pose actually rendered and the API placement fields —
 * so a rack that lands somewhere unexpected can be compared to by-store data.
 *
 * Toggle with the "Coords" button or Ctrl+Shift+D.
 */

import { useEffect, useMemo, useState } from 'react'
import { FiCopy, FiCrosshair, FiX } from 'react-icons/fi'
import { usePlanogramStore } from '@/store/planogramStore'
import type { Rack } from '@/store/planogramStore'
import { getRotatedFootprintHalf, isRackInsideFloor } from '@/utils/rackPlacement'

const SOURCE_LABEL: Record<string, string> = {
  api: 'by-store API',
  'live edit': 'live edit (not reloaded)',
}

const SOURCE_COLOR: Record<string, string> = {
  api: 'text-emerald-300',
  'live edit': 'text-sky-300',
}

function fmt(n: number | null | undefined, digits = 3): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—'
}

function deg(radians: number | null | undefined): string {
  if (typeof radians !== 'number' || !Number.isFinite(radians)) return '—'
  const d = (radians * 180) / Math.PI
  return `${Math.round(((d % 360) + 360) % 360)}°`
}

interface RackReport {
  id: string
  name: string
  source: string
  size: { width: number; depth: number }
  rendered: { x: number; z: number; rotationY: number; quadrant?: string | null }
  footprint: { minX: number; maxX: number; minZ: number; maxZ: number }
  insideFloor: boolean
  wallGaps: { west: number; east: number; north: number; south: number }
  apiPlacement: Rack['placement']
  lastUpdated?: string | null
}

function buildReport(
  rack: Rack,
  areaWidth: number,
  areaDepth: number,
): RackReport {
  const rotationY = rack.rotation?.y ?? 0
  const { halfW, halfD } = getRotatedFootprintHalf(rack.width, rack.depth, rotationY)
  const { x, z } = rack.position
  const floorHalfW = areaWidth / 2
  const floorHalfD = areaDepth / 2
  return {
    id: rack.rackId || rack.id,
    name: rack.displayName || rack.rackName || rack.rackCode || rack.id,
    source: rack.placementSource ?? 'live edit',
    size: { width: rack.width, depth: rack.depth },
    rendered: { x, z, rotationY, quadrant: rack.quadrant },
    footprint: {
      minX: x - halfW,
      maxX: x + halfW,
      minZ: z - halfD,
      maxZ: z + halfD,
    },
    insideFloor: isRackInsideFloor(
      x,
      z,
      rack.width,
      rack.depth,
      rotationY,
      areaWidth,
      areaDepth,
    ),
    wallGaps: {
      west: x - halfW - -floorHalfW,
      east: floorHalfW - (x + halfW),
      south: z - halfD - -floorHalfD,
      north: floorHalfD - (z + halfD),
    },
    apiPlacement: rack.placement ?? null,
    lastUpdated: rack.lastUpdated,
  }
}

export function PlacementDebugPanel() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const racks = usePlanogramStore((s) => s.area.racks)
  const areaWidth = usePlanogramStore((s) => s.area.width)
  const areaDepth = usePlanogramStore((s) => s.area.depth)
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const reports = useMemo(() => {
    if (!open) return []
    return racks.map((rack) => buildReport(rack, areaWidth, areaDepth))
  }, [open, racks, areaWidth, areaDepth])

  const copyAll = async () => {
    const payload = {
      floor: { width: areaWidth, depth: areaDepth },
      storeId: selectedStoreId,
      racks: reports,
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the panel still shows the values */
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Show placement coordinates (Ctrl+Shift+D)"
        className="absolute bottom-4 right-4 z-[150] flex items-center gap-2 rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-[11px] font-semibold text-gray-200 backdrop-blur hover:bg-black/85"
      >
        <FiCrosshair className="h-3.5 w-3.5" />
        Coords
      </button>
    )
  }

  return (
    <div className="absolute bottom-4 right-4 z-[150] flex max-h-[70vh] w-[420px] flex-col rounded-xl border border-white/15 bg-black/85 text-white shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <FiCrosshair className="h-3.5 w-3.5 text-brand-light" />
          <span className="text-xs font-semibold">Placement debug</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyAll}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-gray-300 hover:bg-white/10"
          >
            <FiCopy className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close placement debug"
          >
            <FiX className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 px-3 py-2 font-mono text-[10px] leading-relaxed text-gray-300">
        <div>
          floor {fmt(areaWidth, 2)} × {fmt(areaDepth, 2)} m — x ∈ [
          {fmt(-areaWidth / 2, 2)}, {fmt(areaWidth / 2, 2)}], z ∈ [{fmt(-areaDepth / 2, 2)},{' '}
          {fmt(areaDepth / 2, 2)}]
        </div>
        <div className="text-gray-500">
          +z = front / entrance · −x = left (west) wall · gaps are metres to each wall
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed">
        {reports.length === 0 && <div className="text-gray-500">No racks loaded.</div>}
        {reports.map((r) => {
          const isSelected = selectedId === r.id || racks.some((k) => k.id === selectedId && (k.rackId || k.id) === r.id)
          return (
            <div
              key={r.id}
              className={`mb-2 rounded-lg border px-2 py-2 ${
                isSelected ? 'border-brand-light/60 bg-brand-light/10' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-sans text-[11px] font-semibold">{r.name}</span>
                <span className={`shrink-0 ${SOURCE_COLOR[r.source] ?? 'text-gray-400'}`}>
                  {SOURCE_LABEL[r.source] ?? r.source}
                </span>
              </div>

              <div className="mt-1 text-gray-300">
                rendered x={fmt(r.rendered.x)} z={fmt(r.rendered.z)} rotY={deg(r.rendered.rotationY)}{' '}
                quad={r.rendered.quadrant ?? '—'}
              </div>
              <div className="text-gray-400">
                size {fmt(r.size.width, 2)} × {fmt(r.size.depth, 2)} m → occupies x [
                {fmt(r.footprint.minX, 2)}, {fmt(r.footprint.maxX, 2)}] z [{fmt(r.footprint.minZ, 2)},{' '}
                {fmt(r.footprint.maxZ, 2)}]
              </div>
              <div className={r.insideFloor ? 'text-gray-400' : 'text-red-300'}>
                {r.insideFloor ? 'inside floor' : 'OUTSIDE FLOOR'} · gaps W={fmt(r.wallGaps.west, 2)}{' '}
                E={fmt(r.wallGaps.east, 2)} N={fmt(r.wallGaps.north, 2)} S={fmt(r.wallGaps.south, 2)}
              </div>
              <div className="text-gray-500">
                api x={fmt(r.apiPlacement?.position?.x)} z={fmt(r.apiPlacement?.position?.z)}{' '}
                rotY={deg(r.apiPlacement?.rotation?.y)} snap={r.apiPlacement?.snapMode ?? '—'}
              </div>
              <div className="text-gray-600">
                server lastUpdated {r.lastUpdated ?? '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
