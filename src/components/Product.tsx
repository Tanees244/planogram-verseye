// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { Product as ProductType } from "@/store/planogramStore";
import { usePlanogramStore } from "@/store/planogramStore";

interface ProductProps {
  product: ProductType;
  position: [number, number, number];
}

export function Product({ product, position }: ProductProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { selectedId, setSelected } = usePlanogramStore();
  const isSelected = selectedId === product.id;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.1 : hovered ? 1.05 : 1);
    }
  });

  return (
    <mesh
      userData={{ id: product.id }}
      ref={meshRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        setSelected(product.id, "product");
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
      castShadow
      receiveShadow
    >
      <boxGeometry args={[product.width, product.height, product.depth]} />
      <meshStandardMaterial
        color={product.color}
        metalness={0.2}
        roughness={0.6}
        emissive={isSelected || hovered ? product.color : "#000000"}
        emissiveIntensity={isSelected ? 0.4 : hovered ? 0.6 : 0}
      />
    </mesh>
  );
}
