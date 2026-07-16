// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { Edges } from "@react-three/drei";
import { Row as RowType, usePlanogramStore } from "@/store/planogramStore";
import { Bin } from "./Bin";
import { RowDividerPosmMesh } from "./RowDividerPosmMesh";
import { safeDim } from "@/utils/safeDimensions";

interface RowProps {
  row: RowType;
  position: [number, number, number];
  rackWidth: number;
  rackDepth: number;
  showBottomBorder?: boolean;
  /** When true, both faces of the row stay open (no back wall). */
  openBothSides?: boolean;
  /** Shift shelf geometry along Z (used for back-to-back double-sided racks). */
  shelfOffsetZ?: number;
  /** Hide row back wall when rack shell already has a back panel. */
  hideBackWall?: boolean;
}

export function Row({
  row,
  position,
  rackWidth,
  rackDepth,
  showBottomBorder = false,
  openBothSides = false,
  shelfOffsetZ = 0,
  hideBackWall = false,
}: RowProps) {
  const meshRef = useRef<Mesh>(null);
  const { selectedId, setSelected } = usePlanogramStore();

  const isSelected = selectedId === row.id;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.03 : 1);
    }
  });

  const rowHeight = safeDim(row.height, 1.5);
  const safeRackWidth = safeDim(rackWidth, 1);
  const safeRackDepth = safeDim(rackDepth, 1);
  const binSpacing = row.bins.length > 0 ? safeRackDepth / row.bins.length : 0;
  const binDepth = binSpacing * 0.9;
  const borderThickness = 0.08;
  const z = shelfOffsetZ;

  const [hovered, setHovered] = useState(false);

  const selectRow = (e: any) => {
    e.stopPropagation();
    setSelected(row.id, "row");
  };

  const rowHoverProps = {
    onPointerOver: (e: any) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      setHovered(false);
      document.body.style.cursor = "default";
    },
  };

  return (
    <group position={position}>
      {/* Hitbox at back – for clicks from behind the rack */}
      <mesh
        userData={{ id: row.id }}
        position={[0, 0, z + safeRackDepth / 2 - 0.05]}
        onClick={selectRow}
        {...rowHoverProps}
      >
        <boxGeometry args={[safeRackWidth, rowHeight, 0.15]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Row as a container: one-sided = back wall blocks access from one side; two-sided = open both sides */}
      {/* Back wall – only for one-sided rows; skip raycast so bins can be clicked */}
      {!openBothSides && !hideBackWall && row.sided !== "two" && (
        <mesh position={[0, 0, z + safeRackDepth / 2]} raycast={() => null}>
          <boxGeometry args={[safeRackWidth, rowHeight, 0.06]} />
          <meshStandardMaterial
            color="#FFFFFF"
            metalness={0.5}
            roughness={0.45}
          />
          <Edges color="#1a252f" lineWidth={2} />
        </mesh>
      )}
      {/* Floor of the slot – click empty shelf areas to select row */}
      <mesh
        ref={meshRef}
        position={[0, -rowHeight / 2 + 0.03, z]}
        onClick={selectRow}
        {...rowHoverProps}
      >
        <boxGeometry args={[safeRackWidth, 0.06, safeRackDepth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          metalness={0.35}
          roughness={0.55}
          emissive={hovered ? "#2C5282" : "#000000"}
          emissiveIntensity={hovered ? 0.3 : 0}
        />
        <Edges
          scale={1}
          threshold={15}
          color={isSelected ? "#2ecc71" : hovered ? "#2C5282" : "#7f8c8d"}
          lineWidth={isSelected ? 2.5 : 2}
        />
      </mesh>
      {/* Front shelf lip – easy row target from the shopper-facing side */}
      <mesh
        position={[0, -rowHeight / 2 + 0.06, z - safeRackDepth / 2]}
        onClick={selectRow}
        {...rowHoverProps}
      >
        <boxGeometry args={[safeRackWidth, 0.12, 0.1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Visible front lip */}
      <mesh
        position={[0, -rowHeight / 2 + 0.06, z - safeRackDepth / 2]}
        raycast={() => null}
      >
        <boxGeometry args={[safeRackWidth, 0.08, 0.06]} />
        <meshStandardMaterial color="#34495e" metalness={0.5} roughness={0.4} />
      </mesh>

      {showBottomBorder && (
        <mesh
          position={[0, -rowHeight / 2 - borderThickness / 2, z]}
          raycast={() => null}
        >
          <boxGeometry args={[safeRackWidth, borderThickness, safeRackDepth]} />
          <meshStandardMaterial
            color="#FFFFFF"
            metalness={0.4}
            roughness={0.5}
            opacity={0.8}
            transparent
          />
        </mesh>
      )}

      {/* Bins inside the row – laid out left-to-right by bin width */}
      {(() => {
        let xCursor = -safeRackWidth / 2
        const maxBinH = Math.max(0.08, rowHeight - 0.08)
        return row.bins.map((bin) => {
          const n = Math.max(row.bins.length, 1)
          const fallbackWidth = safeRackWidth / n
          const slotWidth = safeDim(bin.width, fallbackWidth)
          const binWidth = Math.min(slotWidth, fallbackWidth * 0.95)
          const binDepth = Math.min(safeDim(bin.depth, safeRackDepth), safeRackDepth * 0.95)
          // API sometimes stores shelf-board thickness as bin.height — use row
          // cavity for layout so products aren't crushed to a few centimeters.
          const rawBinH = safeDim(bin.height, maxBinH)
          const binHeightUse =
            rawBinH < maxBinH * 0.35 ? maxBinH : Math.min(rawBinH, maxBinH)
          const xOffset = xCursor + slotWidth / 2
          xCursor += slotWidth
          const binY = -rowHeight / 2 + binHeightUse / 2 + 0.03
          return (
            <Bin
              key={bin.id}
              bin={bin}
              rowId={row.id}
              position={[xOffset, binY, z]}
              binHeight={binHeightUse}
              binDepth={binDepth}
              binWidth={binWidth}
            />
          )
        })
      })()}

      <RowDividerPosmMesh
        posm={row.dividerPosm}
        rowWidth={safeRackWidth}
        rowHeight={rowHeight}
        shelfZ={z - safeRackDepth / 2}
        onSelect={selectRow}
      />
    </group>
  );
}
