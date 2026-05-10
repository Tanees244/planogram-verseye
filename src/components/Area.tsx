// @ts-nocheck
'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, DoubleSide } from 'three'
import { Html } from '@react-three/drei'
import { usePlanogramStore, getQuadrantFromPosition, type Rack as RackType } from '@/store/planogramStore'
import { Rack } from './Rack'

export function Area() {
  const meshRef = useRef<Mesh>(null)

  const {
    area,
    selectedId,
    setSelected,
    addRack,
    addRackToServer,
    isPlacingRack,
    setIsPlacingRack,
    editingRackId,
    setEditingRackId,
    updateRackPosition,
  } = usePlanogramStore()

  const getStore = () => usePlanogramStore.getState()

  const isSelected = selectedId === 'area'

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.01 : 1)
    }
  })

  const [hoverPosition, setHoverPosition] = useState<{ x: number; z: number } | null>(null)

  const handleClick = async (e: any) => {
    e.stopPropagation()
    // Debug: always log clicks to verify handler is running
    // eslint-disable-next-line no-console
    console.log('[Area] handleClick', { editingRackId, isPlacingRack, selectedId })

    if (editingRackId) {
      const point = e.point
      updateRackPosition(editingRackId, { x: point.x, y: 0, z: point.z })
      setEditingRackId(null)
      setHoverPosition(null)
      return
    }

    if (isPlacingRack) {
      const point = e.point
      const state = getStore()
      const dims = state.pendingRackParams
      if (dims) {
        // Correctly pass the saved globalLocationId from pendingRackParams
        addRackToServer({ x: point.x, y: 0, z: point.z }, dims, dims.globalLocationId)
      }
      setIsPlacingRack(false)
      setHoverPosition(null)
    } else {
      setSelected('area', 'area')
    }
  }

  const handlePointerMove = (e: any) => {
    if (isPlacingRack || editingRackId) {
      setHoverPosition({ x: e.point.x, z: e.point.z })
    }
  }

  // Determine walls based on typical rendering
  // "Back" = -Z, "Left" = -X, "Right" = +X
  // Front (+Z) is Open.
  // Walls should be at the edges of the area (width/2, depth/2).
  // Area logic in store forces symmetrical width/depth around 0.
  const halfWid = area.width / 2
  const halfDep = area.depth / 2
  const wallHeight = 5
  const wallThick = 0.5
  const wallY = wallHeight / 2

  // Compass quadrants: Divide area into 4 parts
  // NW (North-West): -X to 0, 0 to +Z
  // NE (North-East): 0 to +X, 0 to +Z
  // SW (South-West): -X to 0, -Z to 0
  // SE (South-East): 0 to +X, -Z to 0
  const divisionLineHeight = 0.02
  const divisionLineY = 0.01

  return (
    <group userData={{ id: 'area' }}>
      {/* FLOOR AREA */}
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        receiveShadow
        onPointerEnter={() => {
          if (isPlacingRack || editingRackId) document.body.style.cursor = 'crosshair'
        }}
        onPointerLeave={() => {
          document.body.style.cursor = 'default'
          setHoverPosition(null)
        }}
      >
        <planeGeometry args={[area.width, area.depth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          side={DoubleSide}
        />
      </mesh>

      {/* QUADRANT DIVISION LINES */}
      {/* North-South division line (vertical, along X=0) */}
      <mesh position={[0, divisionLineY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[divisionLineHeight, area.depth]} />
        <meshStandardMaterial color="#3498db" opacity={0.6} transparent />
      </mesh>

      {/* East-West division line (horizontal, along Z=0) */}
      <mesh position={[0, divisionLineY, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[divisionLineHeight, area.width]} />
        <meshStandardMaterial color="#3498db" opacity={0.6} transparent />
      </mesh>

      {/* COMPASS LABELS – North/South swapped for advanced view (N at -Z, S at +Z) */}
      <Html position={[0, 0.5, halfDep - 1]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span style={{ fontSize: '12px', fontWeight: 400, color: '#5d6d7e', textShadow: '0 0 1px #fff' }}>S</span>
      </Html>
      <Html position={[0, 0.5, -halfDep + 1]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span style={{ fontSize: '12px', fontWeight: 400, color: '#5d6d7e', textShadow: '0 0 1px #fff' }}>N</span>
      </Html>
      <Html position={[halfWid - 1, 0.5, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span style={{ fontSize: '12px', fontWeight: 400, color: '#5d6d7e', textShadow: '0 0 1px #fff' }}>E</span>
      </Html>
      <Html position={[-halfWid + 1, 0.5, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span style={{ fontSize: '12px', fontWeight: 400, color: '#5d6d7e', textShadow: '0 0 1px #fff' }}>W</span>
      </Html>


      {/* RACKS */}
      {area.racks.map((rack: RackType) => (
        <Rack key={rack.id} rack={rack} />
      ))}

      {/* BOUNDARY WALLS */}
      {/* Left Wall (-X) */}
      <mesh position={[-halfWid, wallY, 0]}>
        <boxGeometry args={[wallThick, wallHeight, area.depth]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>

      {/* Right Wall (+X) */}
      <mesh position={[halfWid, wallY, 0]}>
        <boxGeometry args={[wallThick, wallHeight, area.depth]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>

      {/* Back Wall (-Z) */}
      <mesh position={[0, wallY, -halfDep]}>
        <boxGeometry args={[area.width, wallHeight, wallThick]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>

      {/* Placement mode: click floor to place rack (triggered from bottom bar “Place on floor”) */}
      {isPlacingRack && (
        <>
          <Html position={[0, 1.5, 0]} center>
            <div style={{
              background: 'rgba(52, 152, 219, 0.9)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(52, 152, 219, 0.4)',
            }}>
              Click anywhere on the floor to place rack
            </div>
          </Html>
          {/* Quadrant indicator */}
          {hoverPosition && (
            <Html position={[hoverPosition.x, 0.3, hoverPosition.z]} center>
              <div style={{
                background: 'rgba(46, 204, 113, 0.9)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(46, 204, 113, 0.4)',
                whiteSpace: 'nowrap',
              }}>
                {getQuadrantFromPosition(hoverPosition.x, hoverPosition.z)}
              </div>
            </Html>
          )}
        </>
      )}

      {/* Edit rack position: click floor to move selected rack */}
      {editingRackId && (
        <>
          <Html position={[0, 1.5, 0]} center>
            <div style={{
              background: 'rgba(245, 158, 11, 0.9)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
            }}>
              Click on the floor to move rack (no overlap with other racks)
            </div>
          </Html>
          {hoverPosition && (
            <Html position={[hoverPosition.x, 0.3, hoverPosition.z]} center>
              <div style={{
                background: 'rgba(245, 158, 11, 0.9)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                whiteSpace: 'nowrap',
              }}>
                {getQuadrantFromPosition(hoverPosition.x, hoverPosition.z)}
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  )
}
