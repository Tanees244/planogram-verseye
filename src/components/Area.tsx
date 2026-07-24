// @ts-nocheck
'use client'

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, DoubleSide } from 'three'
import { Html } from '@react-three/drei'
import { usePlanogramStore, type Rack as RackType } from '@/store/planogramStore'
import { FIXTURE_LIBRARY } from '@/components/fixtures/types'
import { StoreEnvironment } from '@/components/scene/StoreEnvironment'
import { snapRackToWall, rackOverlapsOthers, snapToGrid } from '@/utils/rackPlacement'
import { PlacementPreview, placementHintLabel } from '@/components/scene/PlacementPreview'
import { PlacementGrid } from '@/components/scene/PlacementGrid'
import { CustomRackLivePreview } from '@/components/scene/CustomRackLivePreview'
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
    fixtureDragActive,
    placingFixtureType,
    pendingRackParams,
    cancelFixturePlacement,
    fixtureDragType,
  } = usePlanogramStore()

  const gridActive = Boolean(isPlacingRack || editingRackId || fixtureDragActive)
  const gridMode = gridActive ? 'active' : 'off'

  const dragDef = fixtureDragType ? FIXTURE_LIBRARY[fixtureDragType] : null
  const movingRack = editingRackId
    ? area.racks.find((r: RackType) => r.id === editingRackId)
    : null
  const gridFixtureWidth =
    pendingRackParams?.width ?? movingRack?.width ?? dragDef?.defaultWidth ?? null
  const gridFixtureDepth =
    pendingRackParams?.depth ?? movingRack?.depth ?? dragDef?.defaultDepth ?? null
  const gridFixtureLabel =
    (placingFixtureType && FIXTURE_LIBRARY[placingFixtureType]?.label) ||
    movingRack?.blueprintName ||
    movingRack?.rackCode ||
    dragDef?.label ||
    null

  const [previewPos, setPreviewPos] = useState<{
    x: number
    z: number
    rotationY: number
    overlaps?: boolean
  } | null>(null)

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
      const state = getStore()
      const rack = state.area.racks.find((r: RackType) => r.id === editingRackId)
      if (!rack) {
        setEditingRackId(null)
        return
      }
      const snapped = snapRackToWall(
        { x: point.x, z: point.z },
        rack.width,
        rack.depth,
        area.width,
        area.depth,
      )
      const rotY = snapped.snapped ? snapped.rotationY : (rack.rotation?.y ?? 0)
      if (
        rackOverlapsOthers(
          {
            x: snapped.x,
            z: snapped.z,
            width: rack.width,
            depth: rack.depth,
            rotationY: rotY,
            excludeId: editingRackId,
          },
          state.area.racks,
        )
      ) {
        usePlanogramStore.setState({
          moveRackError: 'Rack would overlap another rack. Choose a different position.',
        })
        return
      }
      updateRackPosition(editingRackId, { x: snapped.x, y: 0, z: snapped.z })
      if (snapped.snapped) {
        usePlanogramStore.getState().setRackRotationY?.(editingRackId, snapped.rotationY)
      }
      setEditingRackId(null)
      setPreviewPos(null)
      return
    }

    if (isPlacingRack) {
      const point = e.point
      const state = getStore()
      const dims = state.pendingRackParams
      if (dims) {
        const snapped = snapRackToWall(
          { x: point.x, z: point.z },
          dims.width,
          dims.depth,
          area.width,
          area.depth,
        )
        if (
          rackOverlapsOthers(
            {
              x: snapped.x,
              z: snapped.z,
              width: dims.width,
              depth: dims.depth,
              rotationY: snapped.rotationY,
            },
            state.area.racks,
          )
        ) {
          usePlanogramStore.setState({
            addRackError: 'Rack would overlap another rack. Choose a different position.',
          })
          return
        }
        await addRackToServer(
          { x: snapped.x, y: 0, z: snapped.z },
          dims,
          dims.globalLocationId,
          { rotationY: snapped.rotationY, snapToWall: false },
        )
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
        const overlaps = rackOverlapsOthers(
          {
            x: snapped.x,
            z: snapped.z,
            width: pendingRackParams.width,
            depth: pendingRackParams.depth,
            rotationY: snapped.rotationY,
          },
          area.racks,
        )
        setPreviewPos({
          x: snapped.x,
          z: snapped.z,
          rotationY: snapped.rotationY,
          overlaps,
        })
      } else if (editingRackId) {
        const rack = area.racks.find((r: RackType) => r.id === editingRackId)
        if (!rack) return
        const snapped = snapRackToWall(
          { x: e.point.x, z: e.point.z },
          rack.width,
          rack.depth,
          area.width,
          area.depth,
        )
        const rotY = snapped.snapped ? snapped.rotationY : (rack.rotation?.y ?? 0)
        const overlaps = rackOverlapsOthers(
          {
            x: snapped.x,
            z: snapped.z,
            width: rack.width,
            depth: rack.depth,
            rotationY: rotY,
            excludeId: editingRackId,
          },
          area.racks,
        )
        setPreviewPos({ x: snapped.x, z: snapped.z, rotationY: rotY, overlaps })
      } else {
        setPreviewPos({
          x: snapToGrid(e.point.x),
          z: snapToGrid(e.point.z),
          rotationY: 0,
        })
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
          color="#e9eef5"
          roughness={0.55}
          metalness={0.06}
          side={DoubleSide}
        />
      </mesh>

      {/* QUADRANT DIVISION LINES */}
      {/* North-South division line (vertical, along X=0) */}
      <mesh position={[0, divisionLineY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[divisionLineHeight, area.depth]} />
        <meshStandardMaterial color="#2C5282" opacity={0.55} transparent />
      </mesh>

      {/* East-West division line (horizontal, along Z=0) */}
      <mesh position={[0, divisionLineY, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[divisionLineHeight, area.width]} />
        <meshStandardMaterial color="#2C5282" opacity={0.55} transparent />
      </mesh>

      <PlacementGrid
        width={area.width}
        depth={area.depth}
        mode={gridMode}
        fixtureWidth={gridFixtureWidth}
        fixtureDepth={gridFixtureDepth}
        fixtureLabel={gridFixtureLabel}
      />

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
              background: 'linear-gradient(135deg, rgba(44, 82, 130, 0.95), rgba(30, 58, 98, 0.92))',
              color: 'white',
              padding: '12px 22px',
              borderRadius: '14px',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: '0 8px 28px rgba(15, 23, 42, 0.35)',
              border: '1px solid rgba(255,255,255,0.18)',
              maxWidth: 380,
              textAlign: 'center',
              backdropFilter: 'blur(8px)',
            }}>
              {placementHintLabel(placingFixtureType, pendingRackParams)}
              {previewPos?.overlaps ? ' — overlaps another rack' : ' — snaps to floor grid'}
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
