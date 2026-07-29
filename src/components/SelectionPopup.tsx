// @ts-nocheck
'use client'

import { Html } from '@react-three/drei'
import { usePlanogramStore, type Rack, type Product, type Bin, type Row } from '@/store/planogramStore'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { boundsCenterAboveObject } from '@/utils/threeBounds'
import { safePosition } from '@/utils/safeDimensions'
import { useEffect, useMemo, useState } from 'react'
import { displayRackName } from '@/utils/displayRackName'
import { resolveProductFacingId } from '@/utils/storeLayoutLoader'
import { formatCm, formatCmPair, formatCmTriple } from '@/utils/lengthUnits'

type PopupKind = 'product' | 'bin' | 'row' | 'rack'

export function SelectionPopup() {
  const { selectedId, selectedType, area } = usePlanogramStore()
  const { scene } = useThree()
  const [position, setPosition] = useState<Vector3 | null>(null)
  const [data, setData] = useState<any>(null)
  const [kind, setKind] = useState<PopupKind | null>(null)

  useEffect(() => {
    if (!selectedId || !selectedType) {
      setPosition(null)
      setData(null)
      setKind(null)
      return
    }

    if (
      selectedType !== 'product' &&
      selectedType !== 'bin' &&
      selectedType !== 'row' &&
      selectedType !== 'rack'
    ) {
      setPosition(null)
      setData(null)
      setKind(null)
      return
    }

    let foundObj: any = null
    scene.traverse((obj) => {
      if (obj.userData?.id === selectedId) foundObj = obj
    })

    if (foundObj) {
      const center = boundsCenterAboveObject(foundObj)
      if (center) setPosition(center)
    } else if (selectedType === 'rack') {
      const rack = area.racks.find((r: Rack) => r.id === selectedId)
      if (rack) {
        setPosition(
          new Vector3(
            safePosition(rack.position.x, 0),
            Math.max(1.2, (rack.height ?? 2) * 0.55),
            safePosition(rack.position.z, 0),
          ),
        )
      }
    }

    if (selectedType === 'product') {
      const catalogId = resolveProductFacingId(selectedId)
      for (const r of area.racks) {
        for (const s of r.sides) {
          for (const row of s.rows) {
            for (const b of row.bins) {
              const p = b.products.find(
                (prod: Product) =>
                  prod.id === selectedId || resolveProductFacingId(prod.id) === catalogId,
              )
              if (p) {
                setData({ ...p, __binName: b.binName, __qty: p.quantity })
                setKind('product')
                return
              }
            }
          }
        }
      }
    } else if (selectedType === 'rack') {
      const r = area.racks.find((rack: Rack) => rack.id === selectedId)
      if (r) {
        setData(r)
        setKind('rack')
      }
    } else if (selectedType === 'bin') {
      for (const r of area.racks) {
        for (const s of r.sides) {
          for (const row of s.rows) {
            const b = row.bins.find((bin: Bin) => bin.id === selectedId)
            if (b) {
              setData({
                ...b,
                __rackName: displayRackName(r),
                __skuCount: b.products.length,
                __facings: b.products.reduce(
                  (n, p) => n + Math.max(1, Math.floor(Number(p.quantity) || 1)),
                  0,
                ),
              })
              setKind('bin')
              return
            }
          }
        }
      }
    } else if (selectedType === 'row') {
      for (const r of area.racks) {
        for (const s of r.sides) {
          const row = s.rows.find((row: Row) => row.id === selectedId)
          if (row) {
            setData({
              ...row,
              __rackName: displayRackName(r),
              __binCount: row.bins.length,
            })
            setKind('row')
            return
          }
        }
      }
    }
  }, [selectedId, selectedType, scene, area])

  const chip = useMemo(() => {
    if (!kind || !data) return null
    if (kind === 'product') {
      return {
        eyebrow: 'Product',
        title: data.name || 'SKU',
        accent: data.color || '#34d399',
        lines: [
          formatCmTriple(data.width, data.depth, data.height),
          data.__qty > 1 ? `${data.__qty} facings` : null,
          data.brandName || null,
        ].filter(Boolean),
      }
    }
    if (kind === 'bin') {
      return {
        eyebrow: 'Bin',
        title: data.binName || 'Bin',
        accent: '#38bdf8',
        lines: [
          formatCmTriple(data.width, data.depth, data.height),
          data.__skuCount
            ? `${data.__skuCount} SKU · ${data.__facings} facings`
            : 'Empty — attach a product',
          data.__rackName || null,
        ].filter(Boolean),
      }
    }
    if (kind === 'row') {
      return {
        eyebrow: 'Row',
        title: `Row · ${formatCm(data.height)} high`,
        accent: '#a78bfa',
        lines: [
          `${data.__binCount} bin${data.__binCount === 1 ? '' : 's'}`,
          data.__rackName || null,
        ].filter(Boolean),
      }
    }
    return {
      eyebrow: 'Rack',
      title: displayRackName(data),
      accent: '#60a5fa',
      lines: [
        data.rackCode ? `Code ${data.rackCode}` : null,
        formatCmPair(Number(data.width), Number(data.depth)),
        data.fixtureType ? String(data.fixtureType).replace(/_/g, ' ') : null,
      ].filter(Boolean),
    }
  }, [kind, data])

  if (!position || !chip) return null

  return (
    <Html position={position} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
      <div className="animate-in fade-in zoom-in-95 duration-150 origin-bottom">
        <div
          className="min-w-[168px] max-w-[220px] rounded-xl border border-slate-500/80 bg-[#0f172a] shadow-2xl shadow-black/50 px-3 py-2.5 text-left"
          style={{ transform: 'translateY(-14px)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: chip.accent, boxShadow: `0 0 10px ${chip.accent}` }}
            />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {chip.eyebrow}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-white leading-snug truncate">{chip.title}</p>
          <div className="mt-1.5 space-y-0.5">
            {chip.lines.map((line) => (
              <p key={line} className="text-[10px] text-slate-300 truncate">
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="mx-auto w-0 h-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#0f172a]" />
      </div>
    </Html>
  )
}
