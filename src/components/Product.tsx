// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, Texture, TextureLoader, SRGBColorSpace } from "three";
import { Product as ProductType } from "@/store/planogramStore";
import { usePlanogramStore } from "@/store/planogramStore";
import {
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
} from "@/constants/dimensions";
import { safeDim } from "@/utils/safeDimensions";

interface ProductProps {
  product: ProductType;
  position: [number, number, number];
}

export function Product({ product, position }: ProductProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState<Texture | null>(null);
  const { selectedId, setSelected } = usePlanogramStore();
  const isSelected = selectedId === product.id;

  // Load the product image as a texture; fall back to the color if it fails.
  useEffect(() => {
    const url = product.imageUrl;
    if (!url) {
      setTexture(null);
      return;
    }
    let active = true;
    // Route through our same-origin proxy so the WebGL texture isn't blocked by
    // the image host's missing CORS headers.
    const proxiedUrl = `/api/files/image?url=${encodeURIComponent(url)}`;
    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      proxiedUrl,
      (tex) => {
        if (!active) {
          tex.dispose();
          return;
        }
        tex.colorSpace = SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {
        if (active) setTexture(null);
      },
    );
    return () => {
      active = false;
    };
  }, [product.imageUrl]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

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
      <boxGeometry
        args={[
          safeDim(product.width, DEFAULT_PRODUCT_WIDTH),
          safeDim(product.height, DEFAULT_PRODUCT_HEIGHT),
          safeDim(product.depth, DEFAULT_PRODUCT_DEPTH),
        ]}
      />
      <meshStandardMaterial
        key={texture ? "with-texture" : "no-texture"}
        map={texture ?? undefined}
        color={texture ? "#ffffff" : product.color}
        metalness={0.2}
        roughness={0.6}
        emissive={isSelected || hovered ? (texture ? "#ffffff" : product.color) : "#000000"}
        emissiveIntensity={isSelected ? 0.25 : hovered ? 0.35 : 0}
      />
    </mesh>
  );
}
