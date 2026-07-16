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
import { expandProductsByQuantity } from "@/utils/storeLayoutLoader";
import { safeDim } from "@/utils/safeDimensions";

interface BinProps {
  bin: BinType;
  rowId: string;
  position: [number, number, number];
  binHeight: number;
  binDepth: number;
  binWidth: number;
}

function facingFitScale(
  productW: number,
  productH: number,
  productD: number,
  binW: number,
  binH: number,
  binD: number,
) {
  return Math.min(
    binH / Math.max(productH, 0.001),
    binD / Math.max(productD, 0.001),
    binW / Math.max(productW, 0.001),
    1,
  )
}

export function Bin({
  bin,
  rowId,
  position,
  binHeight,
  binDepth,
  binWidth,
}: BinProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const {
    selectedId,
    setSelected,
    isPlacingProduct,
    placeProductOnBin,
    productDropHover,
    pendingProductParams,
    setProductDropHover,
    canProductFitInBin,
    attachFacingPreview,
  } = usePlanogramStore();

  const isSelected = selectedId === bin.id;
  const placing = isPlacingProduct;
  const dropHover = productDropHover?.binId === bin.id;
  const dropFits = productDropHover?.fits ?? true;
  const showPlacementPreview =
    Boolean(pendingProductParams) && placing && (dropHover || hovered);
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
  const wallThick = 0.02;
  const lipHeight = 0.02;

  const facings = expandProductsByQuantity(bin.products);

  // Lay out facings along bin width (X); sit on shelf floor (Y); flush to shopper-facing front (−Z)
  const shelfY = -actualBinHeight / 2 + lipHeight
  const frontInset = 0.01
  let xOffset = -actualBinWidth / 2 + wallThick
  const productPositions: [number, number, number][] = []
  const scaledFacings = facings.map((product) => {
    const pw = safeDim(product.width, 0.08)
    const ph = safeDim(product.height, 0.27)
    const pd = safeDim(product.depth, 0.08)
    const fitScale = facingFitScale(pw, ph, pd, actualBinWidth, actualBinHeight, actualBinDepth)
    const facingWidth = pw * fitScale
    const facingHeight = ph * fitScale
    const facingDepth = pd * fitScale
    const px = xOffset + facingWidth / 2
    const pz = -actualBinDepth / 2 + facingDepth / 2 + frontInset
    productPositions.push([px, shelfY + facingHeight / 2, pz])
    xOffset += facingWidth
    return {
      ...product,
      width: facingWidth,
      height: facingHeight,
      depth: facingDepth,
    }
  })

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
    const pw = safeDim(pendingProductParams.width, 0.08)
    const ph = safeDim(pendingProductParams.height, 0.27)
    const pd = safeDim(pendingProductParams.depth, 0.08)
    const fitScale = facingFitScale(pw, ph, pd, actualBinWidth, actualBinHeight, actualBinDepth)
    const w = pw * fitScale
    const h = ph * fitScale
    const d = pd * fitScale
    previewSlots.push({
      pos: [
        xOffset + w / 2,
        shelfY + h / 2,
        -actualBinDepth / 2 + d / 2 + frontInset,
      ],
      w,
      h,
      d,
      fits: dropFits,
      modelUrl: pendingProductParams.modelUrl,
      modelStorageKey: pendingProductParams.modelStorageKey,
      color: pendingProductParams.color ?? "#10b981",
    })
  } else if (attachPreview && attachPreview.quantity > 0) {
    const pw = safeDim(attachPreview.width, 0.08)
    const ph = safeDim(attachPreview.height, 0.27)
    const pd = safeDim(attachPreview.depth, 0.08)
    const fitScale = facingFitScale(pw, ph, pd, actualBinWidth, actualBinHeight, actualBinDepth)
    const w = pw * fitScale
    const h = ph * fitScale
    const d = pd * fitScale
    const maxSlots = Math.max(
      1,
      Math.floor((actualBinWidth - wallThick * 2) / Math.max(w, 0.001)),
    )
    const count = Math.min(attachPreview.quantity, maxSlots + 4, 40)
    let px = xOffset
    for (let i = 0; i < count; i++) {
      previewSlots.push({
        pos: [
          px + w / 2,
          shelfY + h / 2,
          -actualBinDepth / 2 + d / 2 + frontInset,
        ],
        w,
        h,
        d,
        fits: attachPreview.fits && i < maxSlots,
        modelUrl: attachPreview.modelUrl,
        modelStorageKey: attachPreview.modelStorageKey,
        color: attachPreview.color ?? "#2C5282",
      })
      px += w
    }
  }

  const updatePlacementHover = (active: boolean) => {
    if (!placing || !pendingProductParams) {
      if (!active) setProductDropHover(null)
      return
    }
    if (!active) {
      if (productDropHover?.binId === bin.id) setProductDropHover(null)
      return
    }
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
    if (isPlacingProduct) {
      const res = await placeProductOnBin(bin.id, 1);
      if (!res.success && res.message) {
        /* error shown via store.addProductError */
      }
      return;
    }
    setSelected(bin.id, "bin");
  };

  return (
    <group position={position} userData={{ id: bin.id, type: 'bin' }}>
      {/* Base – box covering the row segment, sits on shelf */}
      <mesh
        userData={{ id: bin.id, type: 'bin' }}
        ref={meshRef}
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
          metalness={0.25}
          roughness={0.55}
          transparent
          opacity={isSelected || (placing && hovered) || dropHover ? 0.7 : 0.5}
          emissive={
            dropHover || (placing && hovered)
              ? dropFits
                ? "#059669"
                : "#dc2626"
              : hovered || (placing && isSelected)
                ? "#2C5282"
                : placing
                  ? "#059669"
                  : "#000000"
          }
          emissiveIntensity={hovered || placing || dropHover ? 0.45 : 0}
        />
        <Edges
          scale={1}
          threshold={15}
          color={
            dropHover || (placing && hovered)
              ? dropFits
                ? "#10b981"
                : "#ef4444"
              : isSelected
                ? "#2C5282"
                : hovered
                  ? "#2C5282"
                  : "#2c3e50"
          }
          lineWidth={isSelected || (placing && hovered) || dropHover ? 3 : 2}
        />
      </mesh>
      {/* Lip/rim – skip raycast so clicks hit the main bin mesh */}
      <mesh
        position={[0, actualBinHeight / 2 + lipHeight / 2, 0]}
        raycast={() => null}
      >
        <boxGeometry
          args={[
            actualBinWidth + wallThick * 2,
            lipHeight,
            actualBinDepth + wallThick * 2,
          ]}
        />
        <meshStandardMaterial color="#FFFFFF" metalness={0.4} roughness={0.5} />
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
      {scaledFacings.map((product, index) => (
        <Product
          key={`${bin.id}-${index}-${product.id}`}
          product={product}
          rowId={rowId}
          position={productPositions[index] ?? [0, 0, 0]}
        />
      ))}
    </group>
  );
}
