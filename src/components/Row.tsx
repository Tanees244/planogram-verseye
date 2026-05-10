// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { Edges, Html } from "@react-three/drei";
import { Row as RowType, usePlanogramStore } from "@/store/planogramStore";
import { Bin } from "./Bin";

interface RowProps {
  row: RowType;
  position: [number, number, number];
  rackWidth: number;
  rackDepth: number;
  showBottomBorder?: boolean;
}

export function Row({
  row,
  position,
  rackWidth,
  rackDepth,
  showBottomBorder = false,
}: RowProps) {
  const meshRef = useRef<Mesh>(null);
  const { selectedId, setSelected } = usePlanogramStore();

  const isSelected = selectedId === row.id;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.05 : 1);
    }
  });

  const binSpacing = row.bins.length > 0 ? rackDepth / row.bins.length : 0;
  const binDepth = binSpacing * 0.9;
  const borderThickness = 0.08;

  const [hovered, setHovered] = useState(false);

  const selectRow = (e: any) => {
    e.stopPropagation();
    setSelected(row.id, "row");
  };

  return (
    <group position={position}>
      {/* Hitbox for row selection – pushed to the back so bins in front get hit first */}
      <mesh
        userData={{ id: row.id }}
        position={[0, 0, rackDepth / 2 - 0.05]}
        onClick={selectRow}
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
        <boxGeometry args={[rackWidth, row.height, 0.1]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Row as a container: one-sided = back wall blocks access from one side; two-sided = open both sides */}
      {/* Back wall – only for one-sided rows; skip raycast so bins can be clicked */}
      {row.sided !== "two" && (
        <mesh position={[0, 0, rackDepth / 2]} raycast={() => null}>
          <boxGeometry args={[rackWidth, row.height, 0.06]} />
          <meshStandardMaterial
            color="#FFFFFF"
            metalness={0.5}
            roughness={0.45}
          />
          <Edges color="#1a252f" lineWidth={2} />
        </mesh>
      )}
      {/* Floor of the slot – skip raycast so bins can be clicked */}
      <mesh
        ref={meshRef}
        position={[0, -row.height / 2 + 0.03, 0]}
        raycast={() => null}
      >
        <boxGeometry args={[rackWidth, 0.06, rackDepth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          metalness={0.35}
          roughness={0.55}
          emissive={hovered ? "#3498db" : "#000000"}
          emissiveIntensity={hovered ? 0.3 : 0}
        />
        <Edges
          scale={1}
          threshold={15}
          color={isSelected ? "#2ecc71" : hovered ? "#3498db" : "#7f8c8d"}
          lineWidth={isSelected ? 2.5 : 2}
        />
      </mesh>
      {/* Front lip – skip raycast so clicks reach bins in front */}
      <mesh
        position={[0, -row.height / 2 + 0.06, -rackDepth / 2]}
        raycast={() => null}
      >
        <boxGeometry args={[rackWidth, 0.08, 0.06]} />
        <meshStandardMaterial color="#34495e" metalness={0.5} roughness={0.4} />
      </mesh>

      {showBottomBorder && (
        <mesh
          position={[0, -row.height / 2 - borderThickness / 2, 0]}
          raycast={() => null}
        >
          <boxGeometry args={[rackWidth, borderThickness, rackDepth]} />
          <meshStandardMaterial
            color="#FFFFFF"
            metalness={0.4}
            roughness={0.5}
            opacity={0.8}
            transparent
          />
        </mesh>
      )}

      {/* Bins inside the row – centered vertically, fill row height */}
      {row.bins.map((bin, index) => {
        const n = Math.max(row.bins.length, 1);
        // Calculate bin width: split row width equally among bins
        const calculatedBinWidth = rackWidth / n;
        // Constrain bin width to fit within allocated space (with small margin for spacing)
        const binWidth = Math.min(
          bin.width ?? calculatedBinWidth,
          calculatedBinWidth * 0.95,
        );
        // Constrain bin depth to row depth (with small margin)
        const binDepth = Math.min(bin.depth ?? rackDepth, rackDepth * 0.95);
        // Bin height should match row height (minus small clearance for floor/lip)
        const binHeightUse = bin.height ?? row.height - 0.15;
        // Position bins evenly across row width, starting from left edge
        // Use calculatedBinWidth for positioning to ensure even spacing
        const xOffset = -rackWidth / 2 + calculatedBinWidth * (index + 0.5);
        // Center bin vertically in the row (row group is at position, bin at y=0 is centered in row)
        const binY = 0;
        return (
          <Bin
            key={bin.id}
            bin={bin}
            position={[xOffset, binY, 0]}
            binHeight={binHeightUse}
            binDepth={binDepth}
            binWidth={binWidth}
          />
        );
      })}
    </group>
  );
}
