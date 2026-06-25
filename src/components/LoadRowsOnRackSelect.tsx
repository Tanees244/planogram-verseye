"use client"

import { useEffect, useRef } from 'react'
import { usePlanogramStore } from '@/store/planogramStore'

export default function LoadRowsOnRackSelect() {
  // Subscribe only to the selection; reading `area` here would cause the effect
  // to re-run on every store mutation (it writes rows back into the store).
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const selectedType = usePlanogramStore((s) => s.selectedType)

  // Remember which sides we've already fetched so sides that legitimately have
  // zero rows on the server don't get fetched in an infinite loop.
  const fetchedSidesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (selectedType !== 'rack' || !selectedId) return

    const setState = usePlanogramStore.setState
    const { area } = usePlanogramStore.getState()
    const rack = area.racks.find((r) => r.id === selectedId)
    if (!rack) return

    let mounted = true

      ; (async () => {
        for (const side of rack.sides) {
          const sideId = side.sideId ?? side.id
          if (!sideId) continue
          // Skip if rows are already loaded
          if (Array.isArray(side.rows) && side.rows.length > 0) continue
          // Skip if we've already fetched this side (prevents refetch loops
          // when the server returns no rows for the side)
          if (fetchedSidesRef.current.has(sideId)) continue
          fetchedSidesRef.current.add(sideId)

          try {
            const res = await fetch(`/api/planogram/rows/${encodeURIComponent(sideId)}`)
            const json = await res.json().catch(() => ({}))
            if (!mounted) return
            if (!res.ok) {
              console.warn('LoadRowsOnRackSelect: failed to fetch rows', json?.message ?? res.status)
              // allow a retry on a future selection if the request failed
              fetchedSidesRef.current.delete(sideId)
              continue
            }

            // normalize: backend may return object with .rows or an array
            const payload = json?.data ?? json
            let rowsArr: any[] = []
            if (Array.isArray(payload)) rowsArr = payload
            else if (payload?.rows && Array.isArray(payload.rows)) rowsArr = payload.rows
            else if (payload?.data && Array.isArray(payload.data)) rowsArr = payload.data

            const normalizedRows = rowsArr.map((r: any) => ({ id: r.id ?? r.rowId ?? r.rackRowId ?? String(Math.random()), height: Number(r.height ?? r.rowHeight ?? 1.5), bins: [], rowNumber: r.rowNumber ?? r.number ?? undefined, note: r.note ?? undefined }))

            // Nothing to write back; avoids an unnecessary store mutation
            if (normalizedRows.length === 0) continue

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
          } catch (err) {
            fetchedSidesRef.current.delete(sideId)
            console.error('LoadRowsOnRackSelect error', err)
          }
        }
      })()

    return () => { mounted = false }
  }, [selectedId, selectedType])

  return null
}
