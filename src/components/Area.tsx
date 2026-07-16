// @ts-nocheck
'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, DoubleSide } from 'three'
import { Html } from '@react-three/drei'
import { usePlanogramStore, type Rack as RackType } from '@/store/planogramStore'
import { SCENE_THEMES } from '@/constants/sceneTheme'
import { StoreEnvironment } from '@/components/scene/StoreEnvironment'
import { PlacementPreview, placementHintLabel } from '@/components/scene/PlacementPreview'
import { CustomRackLivePreview } from '@/components/scene/CustomRackLivePreview'
import { snapRackToWall } from '@/utils/rackPlacement'
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
    sceneTheme,
    placingFixtureType,
    pendingRackParams,
    cancelFixturePlacement,
  } = usePlanogramStore()

  const [previewPos, setPreviewPos] = useState<{ x: number; z: number; rotationY: number } | null>(null)

  const themeCfg = SCENE_THEMES[sceneTheme]

  const getStore = () => usePlanogramStore.getState()

  const isSelected = selectedId === 'area'

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.01 : 1)
    }
  })

  const handleClick = async (e: any) => {
    e.stopPropagation()
    // Debug: always log clicks to verify handler is running
    // eslint-disable-next-line no-console
    console.log('[Area] handleClick', { editingRackId, isPlacingRack, selectedId })

    if (editingRackId) {
      const point = e.point
      updateRackPosition(editingRackId, { x: point.x, y: 0, z: point.z })
      setEditingRackId(null)
      return
    }

    if (isPlacingRack) {
      const point = e.point
      const state = getStore()
      const dims = state.pendingRackParams
      if (dims) {
        await addRackToServer({ x: point.x, y: 0, z: point.z }, dims, dims.globalLocationId)
      }
      cancelFixturePlacement()
      setPreviewPos(null)
      return
    }

    setSelected('area', 'area')
  }

  const handlePointerMove = (e: { point: { x: number; z: number } }) => {
    if (isPlacingRack || editingRackId) {
      if (isPlacingRack && pendingRackParams) {
        const snapped = snapRackToWall(
          { x: e.point.x, z: e.point.z },
          pendingRackParams.width,
          pendingRackParams.depth,
          area.width,
          area.depth,
        )
        setPreviewPos({ x: snapped.x, z: snapped.z, rotationY: snapped.rotationY })
      } else {
        setPreviewPos({ x: e.point.x, z: e.point.z, rotationY: 0 })
      }
    }
  }

  // Determine walls based on typical rendering
  // "Back" = -Z, "Left" = -X, "Right" = +X
  // Front (+Z) is Open.
  // Walls should be at the edges of the area (width/2, depth/2).
  // Area logic in store forces symmetrical width/depth around 0.
  const halfWid = area.width / 2
  const halfDep = area.depth / 2

  // Compass quadrants: Divide area into 4 parts
  // NW (North-West): -X to 0, 0 to +Z
  // NE (North-East): 0 to +X, 0 to +Z
  // SW (South-West): -X to 0, -Z to 0
  // SE (South-East): 0 to +X, -Z to 0
  const divisionLineHeight = 0.02
  const divisionLineY = 0.01

  return (
    <group userData={{ id: 'area' }}>
      <StoreEnvironment
        halfW={halfWid}
        halfD={halfDep}
        width={area.width}
        depth={area.depth}
      />

      {/* Sales floor (inside store shell) */}
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        receiveShadow
        onPointerEnter={() => {
          if (isPlacingRack || editingRackId) document.body.style.cursor = 'crosshair'
        }}
        onPointerLeave={() => {
          document.body.style.cursor = 'default'
          if (isPlacingRack) setPreviewPos(null)
        }}
      >
        <planeGeometry args={[area.width, area.depth]} />
        <meshStandardMaterial
          color={themeCfg.floorColor}
          roughness={themeCfg.floorRoughness}
          emissive={sceneTheme === 'night' ? '#8899aa' : '#000000'}
          emissiveIntensity={sceneTheme === 'night' ? 0.15 : 0}
          side={DoubleSide}
        />
      </mesh>

      {/* QUADRANT DIVISION LINES */}
      {/* North-South division line (vertical, along X=0) */}
      <mesh position={[0, divisionLineY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[divisionLineHeight, area.depth]} />
        <meshStandardMaterial color="#2C5282" opacity={0.6} transparent />
      </mesh>

      {/* East-West division line (horizontal, along Z=0) */}
      <mesh position={[0, divisionLineY, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[divisionLineHeight, area.width]} />
        <meshStandardMaterial color="#2C5282" opacity={0.6} transparent />
      </mesh>

      {/* RACKS */}
      {area.racks.map((rack: RackType) => (
        <Rack key={rack.id} rack={rack} />
      ))}

      <PlacementPreview position={previewPos} />
      <CustomRackLivePreview />

      {/* Placement mode */}
      {isPlacingRack && (
        <>
          <Html position={[0, 2, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(44, 82, 130, 0.9)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(44, 82, 130, 0.4)',
              maxWidth: 360,
              textAlign: 'center',
            }}>
              {placementHintLabel(placingFixtureType, pendingRackParams)}
            </div>
          </Html>
        </>
      )}

      {/* Edit rack position: click floor to move selected rack */}
      {editingRackId && (
        <>
          <Html position={[0, 1.5, 0]} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
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
        </>
      )}
    </group>
  )
}
