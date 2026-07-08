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
  position: [number, number, number];
  binHeight: number;
  binDepth: number;
  binWidth: number;
}

export function Bin({
  bin,
  position,
  binHeight,
  binDepth,
  binWidth,
}: BinProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { selectedId, setSelected, isPlacingProduct, placeProductOnBin } =
    usePlanogramStore();

  const isSelected = selectedId === bin.id;
  const placing = isPlacingProduct;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected || (placing && hovered) ? 1.05 : 1);
    }
  });

  const actualBinWidth = safeDim(binWidth ?? bin.width, 0.35);
  const actualBinDepth = safeDim(binDepth ?? bin.depth, 0.35);
  const actualBinHeight = safeDim(binHeight ?? bin.height, 0.35);
  const wallThick = 0.02;
  const lipHeight = 0.02;

  const facings = expandProductsByQuantity(bin.products);

  // Scale products to fill bin height and depth - products should fill the bin vertically and depth-wise
  const defaultProductHeight = safeDim(facings[0]?.height, 0.35);
  const defaultProductWidth = safeDim(facings[0]?.width, 0.35);
  const defaultProductDepth = safeDim(facings[0]?.depth, 0.35);

  const productHeightScale = actualBinHeight / defaultProductHeight;
  const productDepthScale = actualBinDepth / defaultProductDepth;
  const totalProductsWidth = defaultProductWidth * facings.length;
  const productWidthScale = Math.min(
    productHeightScale,
    facings.length > 0 ? actualBinWidth / Math.max(totalProductsWidth, 0.01) : productHeightScale,
  );

  // Lay out facings along bin width (X), horizontally
  let xOffset = -actualBinWidth / 2 + wallThick;
  const productPositions: [number, number, number][] = [];
  facings.forEach((product) => {
    const scaledWidth =
      (product.width ?? defaultProductWidth) * productWidthScale;
    const px = xOffset + scaledWidth / 2;
    productPositions.push([px, 0, 0]);
    xOffset += scaledWidth;
  });

  const handleBinClick = async (e: any) => {
    e.stopPropagation();
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
          opacity={isSelected || (placing && hovered) ? 0.7 : 0.5}
          emissive={hovered || (placing && isSelected) ? "#2C5282" : placing ? "#059669" : "#000000"}
          emissiveIntensity={hovered || placing ? 0.45 : 0}
        />
        <Edges
          scale={1}
          threshold={15}
          color={
            isSelected
              ? "#2C5282"
              : placing && hovered
                ? "#10b981"
                : hovered
                  ? "#2C5282"
                  : "#2c3e50"
          }
          lineWidth={isSelected || (placing && hovered) ? 3 : 2}
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
      {facings.map((product, index) => {
        const scaledProduct = {
          ...product,
          width: (product.width ?? defaultProductWidth) * productWidthScale,
          height: (product.height ?? defaultProductHeight) * productHeightScale,
          depth: (product.depth ?? defaultProductDepth) * productDepthScale,
        };
        return (
          <Product
            key={product.id}
            product={scaledProduct}
            position={productPositions[index] ?? [0, 0, 0]}
          />
        );
      })}
    </group>
  );
}
