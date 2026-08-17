'use client'

import { Edges } from '@react-three/drei'
import { DoubleSide } from 'three'
import type { RackSurfacePosm } from '@/types/rackBlueprint'
import { usePosmImageSrc } from '@/hooks/usePosmImageSrc'
import { usePosmTexture } from '@/hooks/usePosmTexture'
import {
  SHELF_BIN_FRONT_INSET,
  SHELF_BOARD_CENTER_Y,
  SHELF_FRONT_LIP_CENTER_Y,
  SHELF_FRONT_LIP_DEPTH,
  SHELF_FRONT_LIP_HEIGHT,
} from '@/constants/dimensions'

const POSM_TYPE_COLORS: Record<string, string> = {
  Standee: '#8e44ad',
  ShelfTalker: '#27ae60',
  Flyer: '#2980b9',
}

function TalkerImage({
  url,
  width,
  height,
  frontZ,
}: {
  url: string
  width: number
  height: number
  /** Local Z of the plaque front face (negative = toward aisle / camera). */
  frontZ: number
}) {
  const texture = usePosmTexture(url)

  if (!texture) return null

  // Front of planeGeometry faces +Z; rotate so it faces the aisle (−Z).
  return (
    <mesh
      position={[0, 0, frontZ - 0.002]}
      rotation={[0, Math.PI, 0]}
      raycast={() => null}
    >
      <planeGeometry args={[width * 0.94, height * 0.9]} />
      <meshBasicMaterial
        map={texture}
        transparent
        toneMapped={false}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

const TAG_DEPTH = 0.018
/** Compact shelf-talker plaque — not a strip across the whole slot. */
const TAG_MIN_W = 0.1
const TAG_MAX_W = 0.22

/** Shelf-talker mounted on the front face of the black price rail. */
export function RowDividerPosmMesh({
  posm,
  rowWidth,
  rowHeight,
  shelfZ,
  offsetX = 0,
  tagWidth,
  onSelect,
}: {
  posm: RackSurfacePosm | null | undefined
  rowWidth: number
  rowHeight: number
  shelfZ: number
  /** Bin-local X so the tag sits in front of the products, not empty slot center. */
  offsetX?: number
  tagWidth?: number
  onSelect?: (e: { stopPropagation: () => void }) => void
}) {
  const imageUrl = usePosmImageSrc(posm)

  if (!posm) return null

  const tagW = Math.min(
    Math.max(tagWidth ?? TAG_MIN_W, TAG_MIN_W),
    TAG_MAX_W,
    Math.max(rowWidth, TAG_MIN_W),
  )
  const tagH = SHELF_FRONT_LIP_HEIGHT
  const tagD = TAG_DEPTH
  const color = POSM_TYPE_COLORS[posm.posmType] ?? '#2C5282'
  // Bin origin is shelf-board center + binHeight/2. Black lip lives in row space.
  const lipCenterY =
    -rowHeight / 2 + (SHELF_FRONT_LIP_CENTER_Y - SHELF_BOARD_CENTER_Y)
  const lipFrontZ =
    shelfZ - SHELF_BIN_FRONT_INSET - SHELF_FRONT_LIP_DEPTH / 2
  const frontZ = -tagD / 2

  return (
    <group
      position={[offsetX, lipCenterY, lipFrontZ - tagD / 2]}
      userData={{ type: 'dividerPosm' }}
    >
      <mesh
        renderOrder={12}
        onClick={onSelect}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      >
        <boxGeometry args={[tagW, tagH, tagD]} />
        <meshStandardMaterial
          color={imageUrl ? '#f8fafc' : color}
          emissive={imageUrl ? '#000000' : color}
          emissiveIntensity={imageUrl ? 0 : 0.55}
          metalness={0.1}
          roughness={0.45}
        />
        <Edges color="#ecf0f1" threshold={15} lineWidth={1} />
      </mesh>
      {imageUrl ? (
        <TalkerImage url={imageUrl} width={tagW} height={tagH} frontZ={frontZ} />
      ) : null}
    </group>
  )
}
