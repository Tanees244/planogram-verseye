// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { Edges } from "@react-three/drei";
import { Bin as BinType } from "@/store/planogramStore";
import { usePlanogramStore } from "@/store/planogramStore";
import { Product } from "./Product";
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
  const { selectedId, setSelected, isPlacingProduct, placeProductOnBin, productDropHover, pendingProductParams } =
    usePlanogramStore();

  const isSelected = selectedId === bin.id;
  const placing = isPlacingProduct;
  const dropHover = productDropHover?.binId === bin.id;
  const dropFits = productDropHover?.fits ?? true;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(
        isSelected || (placing && hovered) || dropHover ? 1.05 : 1,
      );
    }
  });

  const actualBinWidth = safeDim(binWidth ?? bin.width, 0.35);
  const actualBinDepth = safeDim(binDepth ?? bin.depth, 0.35);
  const actualBinHeight = safeDim(binHeight ?? bin.height, 0.35);
  const wallThick = 0.02;
  const lipHeight = 0.02;

  const facings = expandProductsByQuantity(bin.products);

  const defaultProductHeight = safeDim(facings[0]?.height, 0.35);
  const defaultProductWidth = safeDim(facings[0]?.width, 0.35);
  const defaultProductDepth = safeDim(facings[0]?.depth, 0.35);

  // Scale to fit bin height/depth only — never stretch facings sideways to fill the shelf.
  const fitScale =
    facings.length > 0
      ? Math.min(
          actualBinHeight / defaultProductHeight,
          actualBinDepth / defaultProductDepth,
        )
      : 1;

  // Lay out facings along bin width (X) at true facing size × fitScale
  let xOffset = -actualBinWidth / 2 + wallThick;
  const productPositions: [number, number, number][] = [];
  facings.forEach((product) => {
    const facingWidth = (product.width ?? defaultProductWidth) * fitScale;
    const px = xOffset + facingWidth / 2;
    productPositions.push([px, 0, 0]);
    xOffset += facingWidth;
  });

  const previewQty = 1;
  const previewFacingWidth = pendingProductParams
    ? safeDim(pendingProductParams.width, defaultProductWidth) * fitScale
    : defaultProductWidth * fitScale;
  const previewFacingDepth = pendingProductParams
    ? safeDim(pendingProductParams.depth, defaultProductDepth) * fitScale
    : defaultProductDepth * fitScale;
  const previewFacingHeight = pendingProductParams
    ? safeDim(pendingProductParams.height, defaultProductHeight) * fitScale
    : defaultProductHeight * fitScale;
  const previewStartX = xOffset;
  const previewSlots: [number, number, number][] = [];
  if (dropHover && pendingProductParams) {
    let px = previewStartX;
    for (let i = 0; i < previewQty; i++) {
      previewSlots.push([px + previewFacingWidth / 2, 0, 0]);
      px += previewFacingWidth;
    }
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
    <group position={position} userData={{ id: bin.id }}>
      {/* Base – box covering the row segment, sits on shelf */}
      <mesh
        userData={{ id: bin.id }}
        ref={meshRef}
        onClick={handleBinClick}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = placing ? "copy" : "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
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
            dropHover
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
            dropHover
              ? dropFits
                ? "#10b981"
                : "#ef4444"
              : isSelected
                ? "#2C5282"
                : placing && hovered
                  ? "#10b981"
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
      {dropHover &&
        pendingProductParams &&
        previewSlots.map((pos, index) => (
          <mesh key={`drop-preview-${index}`} position={pos} raycast={() => null}>
            <boxGeometry
              args={[previewFacingWidth, previewFacingHeight, previewFacingDepth]}
            />
            <meshStandardMaterial
              color={dropFits ? "#10b981" : "#ef4444"}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        ))}
      {facings.map((product, index) => {
        const scaledProduct = {
          ...product,
          width: (product.width ?? defaultProductWidth) * fitScale,
          height: (product.height ?? defaultProductHeight) * fitScale,
          depth: (product.depth ?? defaultProductDepth) * fitScale,
        };
        return (
          <Product
            key={`${bin.id}-${index}-${product.id}`}
            product={scaledProduct}
            rowId={rowId}
            position={productPositions[index] ?? [0, 0, 0]}
          />
        );
      })}
    </group>
  );
}
