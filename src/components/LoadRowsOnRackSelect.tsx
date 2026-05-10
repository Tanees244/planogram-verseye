"use client"

import React, { useEffect } from 'react'
import { usePlanogramStore } from '@/store/planogramStore'

export default function LoadRowsOnRackSelect() {
  const { selectedId, selectedType, area } = usePlanogramStore()
  const setState = usePlanogramStore.setState

  useEffect(() => {
    if (selectedType !== 'rack' || !selectedId) return
    const rack = area.racks.find((r) => r.id === selectedId)
    if (!rack) return

    let mounted = true

      ; (async () => {
        try {
          for (const side of rack.sides) {
            const sideId = side.sideId ?? side.id
            if (!sideId) continue
            // Only fetch if rows are empty
            if (Array.isArray(side.rows) && side.rows.length > 0) continue
            const res = await fetch(`/api/planogram/rows/${encodeURIComponent(sideId)}`)
            const json = await res.json().catch(() => ({}))
            if (!mounted) return
            if (!res.ok) {
              console.warn('LoadRowsOnRackSelect: failed to fetch rows', json?.message ?? res.status)
              continue
            }

            // normalize: backend may return object with .rows or an array
            const payload = json?.data ?? json
            let rowsArr: any[] = []
            if (Array.isArray(payload)) rowsArr = payload
            else if (payload?.rows && Array.isArray(payload.rows)) rowsArr = payload.rows
            else if (payload?.data && Array.isArray(payload.data)) rowsArr = payload.data

            const normalizedRows = rowsArr.map((r: any) => ({ id: r.id ?? r.rowId ?? r.rackRowId ?? String(Math.random()), height: Number(r.height ?? r.rowHeight ?? 1.5), bins: [], rowNumber: r.rowNumber ?? r.number ?? undefined, note: r.note ?? undefined }))

            // apply to store: find rack and side and set rows
            setState((state: any) => {
              const racks = state.area.racks.map((ra: any) => {
                if (ra.id !== rack.id) return ra
                const sides = ra.sides.map((s: any) => {
                  const sid = s.sideId ?? s.id
                  if (sid !== sideId) return s
                  return { ...s, rows: normalizedRows }
                })
                return { ...ra, sides }
              })
              return { area: { ...state.area, racks } }
            })
          }
        } catch (err) {
          console.error('LoadRowsOnRackSelect error', err)
        }
      })()

    return () => { mounted = false }
  }, [selectedId, selectedType, area.racks])

  return null
}
