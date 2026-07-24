/**
 * Pack product facings into a bin:
 * left→right (X), then front→back (Z), then stack up (Y).
 * All dimensions in meters.
 */

export interface FacingPackItem {
  width: number
  height: number
  depth: number
}

export interface FacingPackSlot {
  index: number
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  col: number
  depthRow: number
  layer: number
  /** True when this slot is beyond bin capacity (shown as overflow). */
  overflow: boolean
}

export interface FacingPackResult {
  cols: number
  depthRows: number
  stackLayers: number
  maxFit: number
  slots: FacingPackSlot[]
  packScale: number
  fits: boolean
}

/** Soft cap for rendered meshes (capacity math still uses full maxFit). */
export const FACING_PACK_VISUAL_LIMIT = 48

/**
 * Max full GLB clones per bin. Extra facings use cheap boxes/textures.
 * Each GLB clones meshes+materials — 100 bottles = browser melt.
 */
export const MAX_GLB_FACINGS_PER_BIN = 8


function safePositive(n: number, fallback = 0.08): number {
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Max facings in width × depth × height (stacking). */
export function maxFacingsInBinVolume(
  binWidthM: number,
  binDepthM: number,
  binHeightM: number,
  facingWidthM: number,
  facingDepthM: number,
  facingHeightM: number,
): number {
  if (
    !(binWidthM > 0 && binDepthM > 0 && binHeightM > 0) ||
    !(facingWidthM > 0 && facingDepthM > 0 && facingHeightM > 0)
  ) {
    return 0
  }
  const cols = Math.max(0, Math.floor(binWidthM / facingWidthM + 1e-6))
  const depthRows = Math.max(0, Math.floor(binDepthM / facingDepthM + 1e-6))
  const stackLayers = Math.max(0, Math.floor(binHeightM / facingHeightM + 1e-6))
  return cols * depthRows * stackLayers
}

/** Grid dimensions for W×D×H packing (same rules as maxFacingsInBinVolume). */
export function facingGridSize(
  binWidthM: number,
  binDepthM: number,
  binHeightM: number,
  facingWidthM: number,
  facingDepthM: number,
  facingHeightM: number,
): { cols: number; depthRows: number; stackLayers: number; maxFit: number } {
  const cols = Math.max(0, Math.floor(binWidthM / facingWidthM + 1e-6))
  const depthRows = Math.max(0, Math.floor(binDepthM / facingDepthM + 1e-6))
  const stackLayers = Math.max(0, Math.floor(binHeightM / facingHeightM + 1e-6))
  return {
    cols,
    depthRows,
    stackLayers,
    maxFit: cols * depthRows * stackLayers,
  }
}

/** @deprecated Prefer maxFacingsInBinVolume — footprint only (no stacking). */
export function maxFacingsInBinFootprint(
  binWidthM: number,
  binDepthM: number,
  facingWidthM: number,
  facingDepthM: number,
): number {
  return maxFacingsInBinVolume(binWidthM, binDepthM, 1, facingWidthM, facingDepthM, 1)
}

/**
 * Lay out `quantity` identical facings in a bin cavity.
 * Order: across width → into depth → stacked up.
 * Grid math matches maxFacingsInBinVolume (full bin dims, no wall shrink).
 */
export function packFacingsInBin(options: {
  binWidth: number
  binHeight: number
  binDepth: number
  facing: FacingPackItem
  quantity: number
  /** Width already occupied along the front (existing stock), meters. */
  usedWidthM?: number
  /** Existing facing count already packed in the W×D×H grid. */
  occupiedFacings?: number
  /** Visual inset only — does not change capacity grid. */
  wallThick?: number
  lipHeight?: number
  /** Max slots to materialize for rendering (default FACING_PACK_VISUAL_LIMIT). */
  visualLimit?: number
  /**
   * `depthFirst` (default): across → depth → stack.
   * `stackFirst`: across → stack up → depth — stackable SKUs show stacks on the front face.
   */
  packOrder?: 'depthFirst' | 'stackFirst'
}): FacingPackResult {
  const wallThick = options.wallThick ?? 0
  const lipHeight = options.lipHeight ?? 0
  const binW = safePositive(options.binWidth, 0.35)
  const binH = safePositive(options.binHeight, 0.35)
  const binD = safePositive(options.binDepth, 0.35)

  const fw0 = safePositive(options.facing.width)
  const fh0 = safePositive(options.facing.height, 0.27)
  const fd0 = safePositive(options.facing.depth)

  // Capacity grid from raw dims — must match maxFacingsInBinVolume / attach capacity.
  const grid = facingGridSize(binW, binD, binH, fw0, fd0, fh0)
  let cols = Math.max(grid.cols, grid.maxFit > 0 ? grid.cols : 0)
  let depthRows = Math.max(grid.depthRows, grid.maxFit > 0 ? grid.depthRows : 0)
  let stackLayers = Math.max(grid.stackLayers, grid.maxFit > 0 ? grid.stackLayers : 0)

  // If a single facing does not fit, scale for display and allow at most 1×1×1.
  const unitScale = Math.min(
    binH / Math.max(fh0, 0.001),
    binD / Math.max(fd0, 0.001),
    binW / Math.max(fw0, 0.001),
    1,
  )
  let fw = fw0 * unitScale
  let fh = fh0 * unitScale
  let fd = fd0 * unitScale

  if (cols < 1 || depthRows < 1 || stackLayers < 1) {
    cols = 1
    depthRows = 1
    stackLayers = 1
  }

  const maxFitAbsolute = cols * depthRows * stackLayers

  const occupied = Math.max(0, Math.floor(options.occupiedFacings ?? 0))
  const usedW =
    occupied > 0
      ? 0
      : Math.max(0, Math.min(options.usedWidthM ?? 0, binW))
  const freeW = Math.max(0.001, binW - usedW)
  const freeCols =
    occupied > 0
      ? cols
      : Math.max(0, Math.floor(freeW / Math.max(fw0, 0.001) + 1e-6))
  const useCols = occupied > 0 ? cols : Math.max(1, freeCols || (freeW >= fw0 * unitScale ? 1 : 0))
  const freeMax =
    occupied > 0
      ? Math.max(0, maxFitAbsolute - occupied)
      : Math.max(0, freeCols) * depthRows * stackLayers

  const qty = Math.max(0, Math.floor(options.quantity) || 0)

  // Visual inset only — does not change capacity.
  const inset = Math.max(0, wallThick)
  const placeableW = Math.max(0.001, binW - inset * 2 - usedW)
  const placeableD = Math.max(0.001, binD - inset * 2)
  const placeableH = Math.max(0.001, binH - Math.max(lipHeight, 0))
  const packScale = Math.min(
    1,
    placeableW / Math.max(useCols * fw, 0.001),
    placeableD / Math.max(depthRows * fd, 0.001),
    placeableH / Math.max(stackLayers * fh, 0.001),
  )
  fw *= packScale
  fh *= packScale
  fd *= packScale

  const shelfFloorY = -binH / 2 + Math.max(lipHeight, inset * 0.5, 0.001)
  const startX = -binW / 2 + inset + usedW
  const frontZ = -binD / 2 + inset

  const slots: FacingPackSlot[] = []
  const limit = Math.max(0, options.visualLimit ?? FACING_PACK_VISUAL_LIMIT)
  const renderCount = Math.min(qty, limit)
  const stackFirst = options.packOrder === 'stackFirst'
  for (let i = 0; i < renderCount; i++) {
    const globalIndex = occupied + i
    const overflow = i >= freeMax
    const idx = occupied > 0 ? globalIndex : i
    const gridCols = Math.max(1, useCols)
    let col: number
    let depthRow: number
    let layer: number
    if (stackFirst) {
      // across → stack → depth (front face shows vertical stacks)
      const frontPlane = gridCols * Math.max(1, stackLayers)
      depthRow = Math.floor(idx / Math.max(frontPlane, 1))
      const rem = idx % Math.max(frontPlane, 1)
      col = rem % gridCols
      layer = Math.floor(rem / gridCols)
    } else {
      const fp = gridCols * depthRows
      layer = Math.floor(idx / Math.max(fp, 1))
      const rem = idx % Math.max(fp, 1)
      col = rem % gridCols
      depthRow = Math.floor(rem / gridCols)
    }
    const clampedLayer = Math.min(Math.max(0, layer), Math.max(stackLayers - 1, 0))
    const clampedDepth = Math.min(Math.max(0, depthRow), Math.max(depthRows - 1, 0))
    const x = startX + col * fw + fw / 2
    const y = shelfFloorY + clampedLayer * fh + fh / 2
    const z = frontZ + clampedDepth * fd + fd / 2
    slots.push({
      index: i,
      x,
      y,
      z,
      width: fw,
      height: fh,
      depth: fd,
      col,
      depthRow: clampedDepth,
      layer: clampedLayer,
      overflow: overflow || layer >= stackLayers,
    })
  }

  return {
    cols: Math.max(1, useCols),
    depthRows: Math.max(1, depthRows),
    stackLayers: Math.max(1, stackLayers),
    maxFit: freeMax,
    slots,
    packScale,
    fits: qty <= freeMax,
  }
}

export interface MixedFacingInput {
  id: string
  width: number
  height: number
  depth: number
}

/**
 * Pack mixed facings: left→right, then depth, then stack up.
 * Scales down uniformly if the grid would exceed the bin volume.
 */
export function packMixedFacingsInBin(options: {
  binWidth: number
  binHeight: number
  binDepth: number
  facings: MixedFacingInput[]
  wallThick?: number
  lipHeight?: number
}): {
  positions: { id: string; x: number; y: number; z: number; width: number; height: number; depth: number }[]
  packScale: number
} {
  const wallThick = options.wallThick ?? 0
  const lipHeight = options.lipHeight ?? 0
  const binW = safePositive(options.binWidth, 0.35)
  const binH = safePositive(options.binHeight, 0.35)
  const binD = safePositive(options.binDepth, 0.35)
  const usableW = Math.max(0.001, binW - wallThick * 2)
  const usableD = Math.max(0.001, binD - wallThick * 2)
  const usableH = Math.max(0.001, binH - Math.max(lipHeight, 0))
  // Sit on the bin floor (same as packFacingsInBin) — do not force a lip offset.
  const shelfFloorY = -binH / 2 + Math.max(lipHeight, 0.001)
  const startX = -binW / 2 + wallThick
  const frontZ = -binD / 2 + wallThick

  // Keep catalog size; only shrink a unit that itself cannot fit in the cavity.
  // (Do not pre-crush height to usableH — that kills stacking.)
  const sized = options.facings.map((f) => {
    const pw = safePositive(f.width)
    const ph = safePositive(f.height, 0.27)
    const pd = safePositive(f.depth)
    const s = Math.min(
      ph > usableH ? usableH / ph : 1,
      pd > usableD ? usableD / pd : 1,
      pw > usableW ? usableW / pw : 1,
      1,
    )
    return { id: f.id, width: pw * s, height: ph * s, depth: pd * s }
  })

  const measure = (scale: number) => {
    let x = 0
    let z = 0
    let y = 0
    let rowMaxD = 0
    let layerMaxH = 0
    let maxX = 0
    let maxZ = 0
    let maxY = 0
    const placed: { id: string; x: number; y: number; z: number; w: number; h: number; d: number }[] = []
    for (const f of sized) {
      const w = f.width * scale
      const h = f.height * scale
      const d = f.depth * scale
      if (x > 0 && x + w > usableW + 1e-6) {
        x = 0
        z += rowMaxD
        rowMaxD = 0
      }
      if (z > 0 && z + d > usableD + 1e-6) {
        x = 0
        z = 0
        y += layerMaxH
        rowMaxD = 0
        layerMaxH = 0
      }
      placed.push({ id: f.id, x, y, z, w, h, d })
      rowMaxD = Math.max(rowMaxD, d)
      layerMaxH = Math.max(layerMaxH, h)
      x += w
      maxX = Math.max(maxX, x)
      maxZ = Math.max(maxZ, z + rowMaxD)
      maxY = Math.max(maxY, y + layerMaxH)
    }
    return { placed, maxX, maxZ, maxY }
  }

  let packScale = 1
  let measured = measure(1)
  if (
    measured.maxX > usableW + 1e-6 ||
    measured.maxZ > usableD + 1e-6 ||
    measured.maxY > usableH + 1e-6
  ) {
    packScale = Math.min(
      1,
      usableW / Math.max(measured.maxX, 0.001),
      usableD / Math.max(measured.maxZ, 0.001),
      usableH / Math.max(measured.maxY, 0.001),
    )
    measured = measure(packScale)
  }

  return {
    packScale,
    positions: measured.placed.map((p) => ({
      id: p.id,
      x: startX + p.x + p.w / 2,
      y: shelfFloorY + p.y + p.h / 2,
      z: frontZ + p.z + p.d / 2,
      width: p.w,
      height: p.h,
      depth: p.d,
    })),
  }
}
