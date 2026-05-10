// @ts-nocheck
"use client"

import React, { useEffect } from 'react'
import { usePlanogramStore } from '@/store/planogramStore'

// Small in-file id generator (matches store's style)
const generateId = () => Math.random().toString(36).substring(2, 9)

function normalizeApiRack(raw) {
  const id = raw.id ?? raw.rackId ?? generateId()
  const rackId = raw.id ?? raw.rackId ?? id
  const rackCode = raw.rackCode ?? raw.rack_code ?? `RACK-${rackId}`
  const width = Number(raw.width ?? raw.WIDTH ?? 2.5)
  const depth = Number(raw.depth ?? raw.HEIGHT ?? raw.height ?? 20)
  const sidesRaw = raw.sides ?? raw.Sides ?? []
  const sides = Array.isArray(sidesRaw) && sidesRaw.length > 0
    ? sidesRaw.map((s, idx) => ({
      id: s.id ?? s.sideId ?? generateId(),
      sideId: s.sideId ?? s.id ?? generateId(),
      sideCode: s.sideCode ?? s.side_code ?? `${rackCode}-S${idx + 1}`,
      rows: (s.rows ?? []).map((r) => ({
        id: r.id ?? r.rowId ?? generateId(),
        height: Number(r.height ?? r.rowHeight ?? 1.5),
        bins: []
      }))
    }))
    : [{ id: generateId(), sideId: 'Side1', sideCode: `${rackCode}-S1`, rows: [] }]

  return {
    id,
    rackId,
    rackCode,
    width,
    depth,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    sides,
  }
}

export default function AutoPlaceRacks() {
  const area = usePlanogramStore((s) => s.area)
  const setState = usePlanogramStore.setState

  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await fetch('/api/planogram/racks')
          if (!mounted) return
          const json = await res.json().catch(() => ({}))
          if (!res.ok) {
            console.error('AutoPlaceRacks: backend error', json?.message ?? res.status)
            return
          }

          const raw = json?.data ?? json ?? []
          const arr = Array.isArray(raw) ? raw : raw.racks ?? [raw]

          const normalized = arr.map(normalizeApiRack)

          // Compute placement grid
          const n = normalized.length
          if (n === 0) {
            // clear current racks
            setState((state) => ({ area: { ...state.area, racks: [] } }))
            return
          }

          const cols = Math.ceil(Math.sqrt(n))
          const rows = Math.ceil(n / cols)

          const halfW = area.width / 2
          const halfD = area.depth / 2

          const spacingX = area.width / (cols + 1)
          const spacingZ = area.depth / (rows + 1)

          const placed = normalized.map((r, idx) => {
            const col = idx % cols
            const row = Math.floor(idx / cols)
            const x = -halfW + spacingX * (col + 1)
            const z = halfD - spacingZ * (row + 1)
            return { ...r, position: { x, y: 0, z }, quadrant: undefined }
          })

          // Set into store (replace existing racks)
          setState((state) => ({ area: { ...state.area, racks: placed } }))
        } catch (err) {
          console.error('AutoPlaceRacks fetch error', err)
        }
      })()

    return () => { mounted = false }
  }, [area.width, area.depth])

  return null
}

