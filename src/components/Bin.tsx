// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { Edges } from "@react-three/drei";
import { Bin as BinType } from "@/store/planogramStore";
import { usePlanogramStore } from "@/store/planogramStore";
import { Product } from "./Product";
import { ProductPlacementPreview } from "./ProductPlacementPreview";
import { RowDividerPosmMesh } from "./RowDividerPosmMesh";
import { expandProductsByQuantity, resolveProductFacingId } from "@/utils/storeLayoutLoader";
import { packFacingsInBin, packMixedFacingsInBin } from "@/utils/facingPack";
import { inferPlacementAnchor } from "@/utils/productRowPlacement";
import { clampRowSpanToInner } from "@/utils/rackBlueprintMapper";
import { safeDim } from "@/utils/safeDimensions";
import { isStackableSkuId, resolveIsStackable } from "@/utils/stackableSku";
import type { RackSurfacePosm } from "@/types/rackBlueprint";

interface BinProps {
  bin: BinType;
  rowId: string;
  position: [number, number, number];
  binHeight: number;
  binDepth: number;
  binWidth: number;
  /** Legacy row.dividerPosm when this bin has no itemTagPosm. */
  fallbackPosm?: RackSurfacePosm | null;
}

export function Bin({
  bin,
  rowId,
  position,
  binHeight,
  binDepth,
  binWidth,
  fallbackPosm = null,
}: BinProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const {
    selectedId,
    setSelected,
    isPlacingProduct,
    setProductPlacementTarget,
    productDropHover,
    pendingProductParams,
    setProductDropHover,
    canProductFitInBin,
    attachFacingPreview,
    movingInventoryFromBinId,
    moveBinInventoryToBin,
    cancelMovingBinInventory,
  } = usePlanogramStore();

  const isSelected = selectedId === bin.id;
  const placing = isPlacingProduct || Boolean(movingInventoryFromBinId);
  const dropHover =
    productDropHover?.binId === bin.id ||
    (isPlacingProduct && productDropHover?.rowId === rowId);
  const dropFits = productDropHover?.fits ?? true;
  const isMoveSource = movingInventoryFromBinId === bin.id;
  // Bin-local facing ghosts only for move / attach-modal; row placement ghosts live on Row.
  const showPlacementPreview =
    Boolean(pendingProductParams) &&
    Boolean(movingInventoryFromBinId) &&
    placing &&
    (dropHover || hovered);
  const attachPreview =
    attachFacingPreview?.binId === bin.id ? attachFacingPreview : null;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected || dropHover || (placing && hovered) ? 1.03 : 1)
    }
  });

  const actualBinWidth = safeDim(binWidth ?? bin.width, 0.35);
  const actualBinDepth = safeDim(binDepth ?? bin.depth, 0.35);
  const actualBinHeight = safeDim(binHeight ?? bin.height, 0.35);
  // Match attach preview / capacity grid — no wall inset so a full qty fills the bin.
  const wallThick = 0;
  const lipHeight = 0;

  const facings = expandProductsByQuantity(bin.products);

  const facingDims = facings.map((product) => ({
    id: product.id,
    width: safeDim(product.width, 0.08),
    height: safeDim(product.height, 0.27),
    depth: safeDim(product.depth, 0.08),
  }))
  const firstDim = facingDims[0]
  const uniformPack =
    Boolean(firstDim) &&
    facingDims.every(
      (d) =>
        Math.abs(d.width - firstDim.width) < 1e-6 &&
        Math.abs(d.height - firstDim.height) < 1e-6 &&
        Math.abs(d.depth - firstDim.depth) < 1e-6,
    )

  // Same W×D×H grid as the Attach Product preview — otherwise packed products
  // used a different algorithm and looked sparse / floating after attach.
  let packedPositions: {
    x: number
    y: number
    z: number
    width: number
    height: number
    depth: number
    depthRow: number
    col: number
  }[] = []

  const firstProduct = facings[0]
  const binStackable = Boolean(
    firstProduct &&
      resolveIsStackable(resolveProductFacingId(firstProduct.id), {
        isStackable: firstProduct.isStackable,
      }),
  )
  const packAlign = 'left'

  if (uniformPack && firstDim && facingDims.length > 0) {
    const pack = packFacingsInBin({
      binWidth: actualBinWidth,
      binHeight: actualBinHeight,
      binDepth: actualBinDepth,
      facing: {
        width: firstDim.width,
        height: firstDim.height,
        depth: firstDim.depth,
      },
      quantity: facingDims.length,
      wallThick,
      lipHeight,
      packOrder: binStackable ? 'stackFirst' : 'depthFirst',
      align: packAlign,
      stackable: binStackable,
      visualLimit: facingDims.length,
    })
    packedPositions = pack.slots.map((slot) => ({
      x: slot.x,
      y: slot.y,
      z: slot.z,
      width: slot.width,
      height: slot.height,
      depth: slot.depth,
      depthRow: slot.depthRow,
      col: slot.col,
    }))
  } else if (facingDims.length > 0) {
    const mixed = packMixedFacingsInBin({
      binWidth: actualBinWidth,
      binHeight: actualBinHeight,
      binDepth: actualBinDepth,
      facings: facingDims,
      wallThick,
      lipHeight,
    })
    packedPositions = mixed.positions.map((p, i) => ({
      ...p,
      depthRow: 0,
      col: i,
    }))
  }

  const productPositions: [number, number, number][] = packedPositions.map((p, i) => {
    const explicit = facings[i]?.position
    const explicitX =
      typeof explicit?.x === 'number' && Number.isFinite(explicit.x)
        ? Math.min(Math.max(explicit.x, 0), Math.max(0, actualBinWidth - p.width))
        : null
    const explicitY =
      typeof explicit?.y === 'number' && Number.isFinite(explicit.y)
        ? Math.min(Math.max(explicit.y, 0), Math.max(0, actualBinHeight - p.height))
        : null

    return [
      explicitX === null ? p.x : -actualBinWidth / 2 + explicitX + p.width / 2,
      explicitY === null ? p.y : -actualBinHeight / 2 + explicitY + p.height / 2,
      p.z,
    ]
  })
  const scaledFacings = packedPositions.map((p, i) => ({
    ...facings[i],
    width: p.width,
    height: p.height,
    depth: p.depth,
  }))

  const occupiedFacings = bin.products.reduce(
    (sum, p) => sum + Math.max(1, Math.floor(Number(p.quantity) || 1)),
    0,
  )

  let posmOffsetX = 0
  if (productPositions.length > 0 && packedPositions.length > 0) {
    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    for (let i = 0; i < productPositions.length; i++) {
      const x = productPositions[i][0]
      const w = packedPositions[i]?.width ?? 0.08
      minX = Math.min(minX, x - w / 2)
      maxX = Math.max(maxX, x + w / 2)
    }
    if (Number.isFinite(minX) && Number.isFinite(maxX) && maxX > minX) {
      posmOffsetX = (minX + maxX) / 2
    }
  }

  let previewSlots: {
    pos: [number, number, number]
    w: number
    h: number
    d: number
    fits: boolean
    modelUrl?: string | null
    modelStorageKey?: string | null
    color?: string
  }[] = []

  if (showPlacementPreview && pendingProductParams) {
    const pack = packFacingsInBin({
      binWidth: actualBinWidth,
      binHeight: actualBinHeight,
      binDepth: actualBinDepth,
      facing: {
        width: safeDim(pendingProductParams.width, 0.08),
        height: safeDim(pendingProductParams.height, 0.27),
        depth: safeDim(pendingProductParams.depth, 0.08),
      },
      quantity: 1,
      occupiedFacings,
      wallThick,
      lipHeight,
    })
    const slot = pack.slots[0]
    if (slot) {
      previewSlots.push({
        pos: [slot.x, slot.y, slot.z],
        w: slot.width,
        h: slot.height,
        d: slot.depth,
        fits: dropFits && !slot.overflow,
        modelUrl: pendingProductParams.modelUrl,
        modelStorageKey: pendingProductParams.modelStorageKey,
        color: pendingProductParams.color ?? "#10b981",
      })
    }
  } else if (attachPreview && attachPreview.quantity > 0) {
    const stackable =
      Boolean(attachPreview.isStackable) ||
      isStackableSkuId(attachPreview.skuId) ||
      (pendingProductParams && isStackableSkuId(pendingProductParams.id))
    const pack = packFacingsInBin({
      binWidth: actualBinWidth,
      binHeight: actualBinHeight,
      binDepth: actualBinDepth,
      facing: {
        width: safeDim(attachPreview.width, 0.08),
        height: safeDim(attachPreview.height, 0.27),
        depth: safeDim(attachPreview.depth, 0.08),
      },
      quantity: attachPreview.quantity,
      occupiedFacings,
      wallThick,
      lipHeight,
      packOrder:
        Boolean(attachPreview.isStackable) ||
        isStackableSkuId(attachPreview.skuId) ||
        Boolean(pendingProductParams && isStackableSkuId(pendingProductParams.id))
          ? 'stackFirst'
          : 'depthFirst',
      align: packAlign,
      stackable:
        Boolean(attachPreview.isStackable) ||
        isStackableSkuId(attachPreview.skuId) ||
        Boolean(pendingProductParams && isStackableSkuId(pendingProductParams.id)),
    })
    // GLB ghosts are expensive (scene clone each) — model the front slots,
    // plain ghost boxes beyond that so large quantities still fill the bin.
    const GLB_GHOST_LIMIT = 80
    for (const slot of pack.slots) {
      const useModel = slot.index < GLB_GHOST_LIMIT
      previewSlots.push({
        pos: [slot.x, slot.y, slot.z],
        w: slot.width,
        h: slot.height,
        d: slot.depth,
        fits: attachPreview.fits && !slot.overflow,
        modelUrl: useModel ? attachPreview.modelUrl : null,
        modelStorageKey: useModel ? attachPreview.modelStorageKey : null,
        color: attachPreview.color ?? "#2C5282",
      })
    }
  }

  const updatePlacementHover = (active: boolean) => {
    if (!placing) {
      if (!active) setProductDropHover(null)
      return
    }
    if (isPlacingProduct) {
      if (!active) {
        if (productDropHover?.rowId === rowId) setProductDropHover(null)
        return
      }
      // Row owns the fit preview while placing from the palette.
      setProductDropHover({ rowId, fits: true })
      return
    }
    if (!pendingProductParams && !movingInventoryFromBinId) return
    if (!active) {
      if (productDropHover?.binId === bin.id) setProductDropHover(null)
      return
    }
    if (!pendingProductParams) return
    const fit = canProductFitInBin(bin.id, {
      width: pendingProductParams.width,
      depth: pendingProductParams.depth,
      height: pendingProductParams.height,
      quantity: 1,
    })
    setProductDropHover({
      binId: bin.id,
      fits: fit.fits,
      reason: fit.reason,
    })
  }

  const handleBinClick = async (e: any) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelected(rowId, "row");
      return;
    }
    if (movingInventoryFromBinId) {
      if (movingInventoryFromBinId === bin.id) {
        cancelMovingBinInventory();
        return;
      }
      const res = await moveBinInventoryToBin(movingInventoryFromBinId, bin.id);
      if (!res.success && res.message) {
        usePlanogramStore.setState({ addProductError: res.message });
      }
      return;
    }
    if (isPlacingProduct) {
      const racks = usePlanogramStore.getState().area.racks
      let hostRow: { width?: number; span?: number; bins: BinType[] } | undefined
      let hostRackWidth = actualBinWidth
      for (const rack of racks) {
        for (const side of rack.sides) {
          const row = side.rows.find((r) => r.id === rowId)
          if (row) {
            hostRow = row
            hostRackWidth = clampRowSpanToInner(rack, row.width)
            break
          }
        }
        if (hostRow) break
      }
      const local = e.object.worldToLocal(e.point.clone())
      const rowLocalX = position[0] + local.x
      const anchor = inferPlacementAnchor(
        rowLocalX,
        hostRackWidth,
        hostRow?.bins ?? [],
      )
      const res = setProductPlacementTarget(rowId, { anchor })
      if (!res.success && res.message) {
        usePlanogramStore.setState({ addProductError: res.message })
      }
      return
    }
    const firstSku = bin.products[0]
    if (firstSku) {
      setSelected(resolveProductFacingId(firstSku.id), 'product')
      return
    }
    setSelected(rowId, 'row')
  };

  return (
    <group position={position} userData={{ id: bin.id, type: 'bin' }}>
      {/* Invisible hit volume — when stocked (and not placing), skip so SKU meshes get clicks. */}
      <mesh
        userData={{ id: bin.id, type: 'bin' }}
        ref={meshRef}
        raycast={
          bin.products.length > 0 && !placing && !movingInventoryFromBinId
            ? () => null
            : undefined
        }
        onClick={handleBinClick}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = placing ? "copy" : "pointer";
          updatePlacementHover(true);
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
          updatePlacementHover(false);
        }}
      >
        <boxGeometry args={[actualBinWidth, actualBinHeight, actualBinDepth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          metalness={0.1}
          roughness={0.08}
          transparent
          opacity={isMoveSource || (placing && hovered) || dropHover ? 0.22 : 0}
          depthWrite={false}
          emissive={
            isMoveSource
              ? "#d97706"
              : dropHover || (placing && hovered)
              ? dropFits
                ? "#059669"
                : "#dc2626"
              : "#000000"
          }
          emissiveIntensity={placing || dropHover || isMoveSource ? 0.4 : 0}
        />
        {(isMoveSource || (placing && hovered) || dropHover) && (
          <Edges
            scale={1}
            threshold={15}
            color={
              dropHover || (placing && hovered)
                ? dropFits
                  ? "#10b981"
                  : "#ef4444"
                : "#d97706"
            }
            lineWidth={2.5}
          />
        )}
      </mesh>
      {previewSlots.map((slot, index) => (
        <ProductPlacementPreview
          key={`preview-facing-${index}`}
          position={slot.pos}
          width={slot.w}
          height={slot.h}
          depth={slot.d}
          fits={slot.fits}
          color={slot.color ?? "#10b981"}
          modelUrl={slot.modelUrl}
          modelStorageKey={slot.modelStorageKey}
        />
      ))}
      {scaledFacings.map((product, index) => {
          const hasPicture = Boolean(product.imageUrl || product.imageStorageKey)
          return (
            <Product
              key={`${bin.id}-${index}-${product.id}`}
              product={product}
              binId={bin.id}
              rowId={rowId}
              position={productPositions[index] ?? [0, 0, 0]}
              forceSimple={hasPicture}
            />
          )
        })}
      <RowDividerPosmMesh
        posm={bin.itemTagPosm ?? fallbackPosm}
        rowWidth={actualBinWidth}
        rowHeight={actualBinHeight}
        shelfZ={-actualBinDepth / 2}
        offsetX={posmOffsetX}
        onSelect={(e) => {
          e.stopPropagation()
          const firstSku = bin.products[0]
          if (firstSku) setSelected(resolveProductFacingId(firstSku.id), 'product')
          else setSelected(rowId, 'row')
        }}
      />
    </group>
  );
}
