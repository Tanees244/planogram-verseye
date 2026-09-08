'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import toast from 'react-hot-toast'
import { usePlanogramStore, type Rack } from '@/store/planogramStore'
import type { RackSurfacePosm } from '@/types/rackBlueprint'

export const POSM_DRAG_MIME = 'application/x-aisleris-posm'

export type PosmDragPayload = {
  id: string
  name: string
  posmType: string
  imageUrl?: string | null
  imageStorageKey?: string | null
}

type WallSlot = 'left' | 'right' | 'header' | 'footer'

type DropTarget =
  | { kind: 'bin'; binId: string; rackId: string }
  | { kind: 'row'; rowId: string; rackId: string }
  | { kind: 'wall'; rackId: string; wall: WallSlot }

function isFloorOrAreaHit(obj: THREE.Object3D | null): boolean {
  let cur: THREE.Object3D | null = obj
  while (cur) {
    const id = cur.userData?.id
    const type = cur.userData?.type
    if (type === 'rack' || type === 'row' || type === 'bin' || type === 'rack-wall') return false
    if (id === 'area' || type === 'area' || type === 'floor') return true
    cur = cur.parent
  }
  return false
}

function findRackIdFor(state: ReturnType<typeof usePlanogramStore.getState>, id: string): string | null {
  for (const rack of state.area.racks) {
    if (rack.id === id) return rack.id
    for (const side of rack.sides) {
      if (side.rows.some((r) => r.id === id)) return rack.id
      for (const row of side.rows) {
        if (row.bins.some((b) => b.id === id)) return rack.id
      }
    }
  }
  return null
}

function nearestRowId(rack: Rack, localY: number, rackHeight: number): string | null {
  const rows = rack.sides[0]?.rows ?? []
  if (rows.length === 0) return null
  let yCursor = -Math.max(rackHeight, 0.5) / 2
  let bestId = rows[0].id
  let bestDist = Number.POSITIVE_INFINITY
  for (const row of rows) {
    const h = Number(row.height) > 0 ? Number(row.height) : 0.4
    const cy = yCursor + h / 2
    const dist = Math.abs(localY - cy)
    if (dist < bestDist) {
      bestDist = dist
      bestId = row.id
    }
    yCursor += h
  }
  return bestId
}

function wallFromLocalPoint(local: THREE.Vector3, width: number, height: number): WallSlot | 'row' {
  const halfW = Math.max(width, 0.2) / 2
  const halfH = Math.max(height, 0.5) / 2
  const nx = local.x / halfW
  const ny = local.y / halfH
  if (nx < -0.72) return 'left'
  if (nx > 0.72) return 'right'
  if (ny > 0.72) return 'header'
  if (ny < -0.78) return 'footer'
  return 'row'
}

function findDropTargetFromIntersects(
  intersects: THREE.Intersection[],
): DropTarget | null {
  const state = usePlanogramStore.getState()

  for (const hit of intersects) {
    if (isFloorOrAreaHit(hit.object)) continue

    let obj: THREE.Object3D | null = hit.object
    let rackObj: THREE.Object3D | null = null
    let wallHint: WallSlot | null = null
    let binId: string | null = null
    let rowId: string | null = null
    let rackId: string | null = null

    while (obj) {
      const id = typeof obj.userData?.id === 'string' ? obj.userData.id : ''
      const type = obj.userData?.type
      if (
        type === 'rack-wall' &&
        (obj.userData.wall === 'left' ||
          obj.userData.wall === 'right' ||
          obj.userData.wall === 'header' ||
          obj.userData.wall === 'footer')
      ) {
        wallHint = obj.userData.wall
      }
      if (type === 'bin' && id) binId = binId ?? id
      if (type === 'row' && id) rowId = rowId ?? id
      if (type === 'rack' && id) {
        rackId = rackId ?? id
        rackObj = rackObj ?? obj
      }
      obj = obj.parent
    }

    if (wallHint && rackId) {
      return { kind: 'wall', rackId, wall: wallHint }
    }
    if (binId) {
      const parentRack = findRackIdFor(state, binId)
      if (parentRack) return { kind: 'bin', binId, rackId: parentRack }
    }
    if (rowId) {
      const parentRack = findRackIdFor(state, rowId)
      if (parentRack) return { kind: 'row', rowId, rackId: parentRack }
    }

    if (!rackId) continue
    const rack = state.area.racks.find((r) => r.id === rackId)
    if (!rack || !rackObj) continue

    const local = rackObj.worldToLocal(hit.point.clone())
    const width = Number(rack.width) || 1
    const height = Number(rack.outer?.height ?? rack.height) || 2
    const surface = wallFromLocalPoint(local, width, height)
    if (surface === 'left' || surface === 'right' || surface === 'header' || surface === 'footer') {
      return { kind: 'wall', rackId, wall: surface }
    }
    const nearRow = nearestRowId(rack, local.y, height)
    if (nearRow) return { kind: 'row', rowId: nearRow, rackId }
  }

  return null
}

function findRowIdForBin(state: ReturnType<typeof usePlanogramStore.getState>, binId: string): string | null {
  for (const rack of state.area.racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        if (row.bins.some((b) => b.id === binId)) return row.id
      }
    }
  }
  return null
}

function isPosmNotAttachedToRow(message?: string | null): boolean {
  return /posm\s+not\s+attached\s+to\s+row/i.test(message ?? '')
}

function hasPosmDragType(dt: DataTransfer | null): boolean {
  if (!dt) return false
  return dt.types.includes(POSM_DRAG_MIME) || dt.types.includes('text/plain')
}

function parsePosmPayload(dt: DataTransfer | null): PosmDragPayload | null {
  if (!dt) return null
  const raw = dt.getData(POSM_DRAG_MIME) || dt.getData('text/plain')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PosmDragPayload
    if (parsed?.id) return parsed
  } catch {
    /* ignore */
  }
  return null
}

function rackPosmPatch(
  rack: Rack,
  wall: WallSlot,
  posmId: string,
): {
  headerPosmItemId: string | null
  footerPosmItemId: string | null
  leftWallPosmItemId: string | null
  rightWallPosmItemId: string | null
} {
  const shell = rack.shell
  return {
    headerPosmItemId: wall === 'header' ? posmId : (shell?.headerPosmItemId ?? null),
    footerPosmItemId: wall === 'footer' ? posmId : (shell?.footerPosmItemId ?? null),
    leftWallPosmItemId: wall === 'left' ? posmId : (shell?.leftWallPosmItemId ?? null),
    rightWallPosmItemId: wall === 'right' ? posmId : (shell?.rightWallPosmItemId ?? null),
  }
}

/** Drag POSM from panel onto a shelf row, bin, or rack wall. */
export function PosmDropHandler() {
  const { camera, gl, scene } = useThree()
  const assignBinItemTagPosm = usePlanogramStore((s) => s.assignBinItemTagPosm)
  const assignRowDividerPosm = usePlanogramStore((s) => s.assignRowDividerPosm)
  const assignRackPosmItems = usePlanogramStore((s) => s.assignRackPosmItems)
  const setPosmDragActive = usePlanogramStore((s) => s.setPosmDragActive)

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onDragOver = (e: DragEvent) => {
      if (!hasPosmDragType(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'copy'
    }

    const onDrop = async (e: DragEvent) => {
      const payload = parsePosmPayload(e.dataTransfer)
      if (!payload) return
      e.preventDefault()
      e.stopPropagation()
      setPosmDragActive(false)

      const rect = el.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      const ctx = findDropTargetFromIntersects(hits)
      if (!ctx) {
        toast.error('Drop POSM on a shelf, header, footer, or rack wall.')
        return
      }

      const hydrated: RackSurfacePosm = {
        id: payload.id,
        name: payload.name,
        posmType: payload.posmType,
        imageUrl: payload.imageUrl ?? null,
        imageStorageKey: payload.imageStorageKey ?? null,
      }

      let res: { success: boolean; message?: string }
      let label = 'POSM assigned'
      if (ctx.kind === 'bin') {
        res = await assignBinItemTagPosm(ctx.rackId, ctx.binId, payload.id, hydrated)
        label = 'POSM attached to this bin'
        if (!res.success && isPosmNotAttachedToRow(res.message)) {
          const rowId = findRowIdForBin(usePlanogramStore.getState(), ctx.binId)
          if (rowId) {
            res = await assignRowDividerPosm(ctx.rackId, rowId, payload.id, hydrated)
            label = 'POSM attached to this shelf'
          }
        }
      } else if (ctx.kind === 'row') {
        res = await assignRowDividerPosm(ctx.rackId, ctx.rowId, payload.id, hydrated)
        label = 'POSM attached to this shelf'
      } else {
        const rack = usePlanogramStore.getState().area.racks.find((r) => r.id === ctx.rackId)
        if (!rack) {
          toast.error('Rack not found')
          return
        }
        res = await assignRackPosmItems(
          ctx.rackId,
          rackPosmPatch(rack, ctx.wall, payload.id),
          { [payload.id]: hydrated },
        )
        const wallName =
          ctx.wall === 'left'
            ? 'left wall'
            : ctx.wall === 'right'
              ? 'right wall'
              : ctx.wall === 'header'
                ? 'header'
                : 'footer'
        label = `POSM attached to ${wallName}`
      }
      if (!res.success) {
        if (!isPosmNotAttachedToRow(res.message)) {
          toast.error(res.message ?? 'Failed to assign POSM')
        }
        usePlanogramStore.setState({
          addProductError: isPosmNotAttachedToRow(res.message)
            ? null
            : (res.message ?? 'Failed to assign POSM'),
        })
      } else {
        toast.success(label)
        usePlanogramStore.setState({ addProductError: null })
      }
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
    }
  }, [camera, gl, scene, assignBinItemTagPosm, assignRowDividerPosm, assignRackPosmItems, setPosmDragActive])

  return null
}
