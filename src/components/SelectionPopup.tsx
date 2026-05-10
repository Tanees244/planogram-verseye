// @ts-nocheck
'use client'

import { Html } from '@react-three/drei'
import { usePlanogramStore, type Rack, type Product, type Bin, type Row } from '@/store/planogramStore'
import { useThree } from '@react-three/fiber'
import { Vector3, Box3 } from 'three'
import { useEffect, useState } from 'react'

export function SelectionPopup() {
  const { selectedId, selectedType, area } = usePlanogramStore()
  const { scene } = useThree()
  const [position, setPosition] = useState<Vector3 | null>(null)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!selectedId || !selectedType) {
      setPosition(null)
      setData(null)
      return
    }

    let foundObj: any = null
    scene.traverse((obj) => {
      if (obj.userData?.id === selectedId) {
        foundObj = obj
      }
    })

    if (foundObj) {
      const box = new Box3().setFromObject(foundObj)
      const center = new Vector3()
      box.getCenter(center)
      // Position slightly above the object
      center.y = box.max.y + 0.5
      setPosition(center)
    } else {
      // Fallback calculation for known types if scene graph isn't ready
      if (selectedType === 'rack') {
        const rack = area.racks.find((r: Rack) => r.id === selectedId)
        if (rack) setPosition(new Vector3(rack.position.x, 3, rack.position.z))
      }
    }

    // Get Data
    if (selectedType === 'product') {
      // Search deeply
      for (const r of area.racks) {
        for (const s of r.sides) {
          for (const row of s.rows) {
            for (const b of row.bins) {
              const p = b.products.find((prod: Product) => prod.id === selectedId)
              if (p) setData(p)
            }
          }
        }
      }
    } else if (selectedType === 'rack') {
      const r = area.racks.find((rack: Rack) => rack.id === selectedId)
      if (r) setData(r)
    } else if (selectedType === 'bin') {
      for (const r of area.racks) {
        for (const s of r.sides) {
          for (const row of s.rows) {
            const b = row.bins.find((bin: Bin) => bin.id === selectedId)
            if (b) setData(b)
          }
        }
      }
    } else if (selectedType === 'row') {
      for (const r of area.racks) {
        for (const s of r.sides) {
          const row = s.rows.find((row: Row) => row.id === selectedId)
          if (row) setData(row)
        }
      }
    }

  }, [selectedId, selectedType, scene, area])

  // Don't show popup for area, rack, bin, or row
  if (!position || !data || !selectedId || selectedType === 'area' || selectedType === 'rack' || selectedType === 'bin' || selectedType === 'row') return null

  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <div style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        width: '200px',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        transform: 'translateY(-20px)',
        transition: 'opacity 0.2s',
      }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '14px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          paddingBottom: '5px',
          marginBottom: '5px',
          color: data.color ?? '#3498db'
        }}>
          PRODUCT: {data.name || data.id?.substring(0, 8)}
        </div>

        {/* Popup only shown for product (we return null for area, rack, bin, row) */}
        <div>ID: {data.id}</div>
        <div>Dim: {typeof data.width === 'number' ? data.width.toFixed(2) : data.width}x{typeof data.height === 'number' ? data.height.toFixed(2) : data.height}x{typeof data.depth === 'number' ? data.depth.toFixed(2) : data.depth}</div>
      </div>
      <div style={{
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid rgba(0,0,0,0.85)',
        margin: '0 auto',
      }} />
    </Html>
  )
}
