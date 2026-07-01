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
  const { selectedId, setSelected } = usePlanogramStore();

  const isSelected = selectedId === bin.id;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.05 : 1);
    }
  });

  const actualBinWidth = binWidth ?? bin.width;
  const actualBinDepth = binDepth ?? bin.depth;
  const actualBinHeight = binHeight ?? bin.height;
  const wallThick = 0.02;
  const lipHeight = 0.02;

  const facings = expandProductsByQuantity(bin.products);

  // Scale products to fill bin height and depth - products should fill the bin vertically and depth-wise
  const defaultProductHeight = facings[0]?.height ?? 0.35;
  const defaultProductWidth = facings[0]?.width ?? 0.35;
  const defaultProductDepth = facings[0]?.depth ?? 0.35;

  // Scale height to fill bin height, depth to fill bin depth, width stays proportional or fits bin width
  const productHeightScale = actualBinHeight / defaultProductHeight;
  const productDepthScale = actualBinDepth / defaultProductDepth;
  // For width, scale proportionally but ensure all facings fit in bin width
  const totalProductsWidth = defaultProductWidth * facings.length;
  const productWidthScale = Math.min(
    productHeightScale,
    facings.length > 0 ? actualBinWidth / totalProductsWidth : productHeightScale,
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

  const [hovered, setHovered] = useState(false);

  const handleBinClick = (e: any) => {
    e.stopPropagation();
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
          document.body.style.cursor = "pointer";
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
          opacity={isSelected ? 0.6 : 0.5}
          emissive={hovered ? "#3498db" : "#000000"}
          emissiveIntensity={hovered ? 0.4 : 0}
        />
        <Edges
          scale={1}
          threshold={15}
          color={isSelected ? "#2980b9" : hovered ? "#3498db" : "#2c3e50"}
          lineWidth={isSelected ? 3 : 2}
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
