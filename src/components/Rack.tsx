// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { Edges, Html } from "@react-three/drei";
import { Rack as RackType } from "@/store/planogramStore";
import { usePlanogramStore } from "@/store/planogramStore";
import { Row } from "./Row";

interface RackProps {
  rack: RackType;
}

export function Rack({ rack }: RackProps) {
  const meshRef = useRef<Mesh>(null);
  const { selectedId, setSelected } = usePlanogramStore();
  const [hovered, setHovered] = useState(false);

  const isSelected = selectedId === rack.id;

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = "default";
  };

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected ? 1.02 : 1);
    }
  });

  const maxRows = Math.max(...rack.sides.map((s) => s.rows.length), 0);
  const totalRowHeight =
    rack.sides.length > 0
      ? Math.max(
          ...rack.sides.map((side) =>
            side.rows.reduce((sum, r) => sum + r.height, 0),
          ),
        )
      : 0;
  const rackHeight = maxRows > 0 ? totalRowHeight + 0.5 : 2;
  const rackCenterY = rackHeight / 2;
  const hasContent = rack.sides.some((side) => side.rows.length > 0);
  const groupY = hasContent ? rackCenterY : (rack.position.y ?? 0);

  const sideOffset = rack.sides.length === 2 ? rack.width / 4 : 0;
  const isDoubleSided = Boolean(rack.isDoubleSided) || rack.sides.length >= 2;

  const selectRack = (e: any) => {
    e.stopPropagation();
    setSelected(rack.id, "rack");
  };

  const rot = rack.rotation ?? { x: 0, y: 0, z: 0 };

  return (
    <group
      userData={{ id: rack.id }}
      position={[rack.position.x, groupY, rack.position.z]}
      rotation={[rot.x, rot.y, rot.z]}
    >
      {/* Main vertical supports - only show if rack has content */}
      {hasContent && (
        <>
          <mesh
            position={[-rack.width / 2, 0, -rack.depth / 2]}
            onClick={selectRack}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[0.15, rackHeight, 0.15]} />
            <meshStandardMaterial
              color="#FFFFFF"
              metalness={0.7}
              roughness={0.3}
              emissive={hovered ? "#3498db" : "#000000"}
              emissiveIntensity={hovered ? 0.3 : 0}
            />
          </mesh>
          <mesh
            position={[rack.width / 2, 0, -rack.depth / 2]}
            onClick={selectRack}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[0.15, rackHeight, 0.15]} />
            <meshStandardMaterial
              color="#FFFFFF"
              metalness={0.7}
              roughness={0.3}
              emissive={hovered ? "#3498db" : "#000000"}
              emissiveIntensity={hovered ? 0.3 : 0}
            />
          </mesh>
          <mesh
            position={[-rack.width / 2, 0, rack.depth / 2]}
            onClick={selectRack}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[0.15, rackHeight, 0.15]} />
            <meshStandardMaterial
              color="#FFFFFF"
              metalness={0.7}
              roughness={0.3}
              emissive={hovered ? "#3498db" : "#000000"}
              emissiveIntensity={hovered ? 0.3 : 0}
            />
          </mesh>
          <mesh
            position={[rack.width / 2, 0, rack.depth / 2]}
            onClick={selectRack}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[0.15, rackHeight, 0.15]} />
            <meshStandardMaterial
              color="#FFFFFF"
              metalness={0.7}
              roughness={0.3}
              emissive={hovered ? "#3498db" : "#000000"}
              emissiveIntensity={hovered ? 0.3 : 0}
            />
          </mesh>

          {/* Top beam */}
          <mesh
            position={[0, rackHeight / 2 - 0.05, 0]}
            onClick={selectRack}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[rack.width + 0.2, 0.1, rack.depth + 0.2]} />
            <meshStandardMaterial
              color="#FFFFFF"
              metalness={0.6}
              roughness={0.4}
              emissive={hovered ? "#3498db" : "#000000"}
              emissiveIntensity={hovered ? 0.2 : 0}
            />
            <Edges color={hovered ? "#3498db" : "#1a252f"} lineWidth={2} />
          </mesh>

          {/* Bottom base – top of base at y = -rackHeight/2 + 0.2 */}
          <mesh
            position={[0, -rackHeight / 2 + 0.1, 0]}
            onClick={selectRack}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[rack.width + 0.2, 0.2, rack.depth + 0.2]} />
            <meshStandardMaterial
              color="#FFFFFF"
              metalness={0.6}
              roughness={0.4}
              emissive={hovered ? "#3498db" : "#000000"}
              emissiveIntensity={hovered ? 0.2 : 0}
            />
            <Edges color={hovered ? "#3498db" : "#1a252f"} lineWidth={2} />
          </mesh>
        </>
      )}

      {/* Empty rack: show plank type on floor (flat rectangle) */}
      {!hasContent && (
        <group>
          <mesh
            position={[0, 0.04, 0]}
            onClick={selectRack}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[rack.width, 0.08, rack.depth]} />
            <meshStandardMaterial
              color="#FFFFFF"
              metalness={0.3}
              roughness={0.6}
              emissive={hovered ? "#3498db" : "#000000"}
              emissiveIntensity={hovered ? 0.3 : 0}
            />
            <Edges color={hovered ? "#3498db" : "#5d6d7e"} lineWidth={2} />
          </mesh>
          <Html
            position={[0, 0.12, 0]}
            center
            style={{
              pointerEvents: "none",
              fontSize: "10px",
              color: isSelected ? "#3498db" : hovered ? "#3498db" : "#ecf0f1",
              textShadow: "0 0 1px #000",
              whiteSpace: "nowrap",
            }}
          >
            {rack.height || "standard"}
          </Html>
        </group>
      )}

      {/* Back wall for single-sided racks only */}
      {!isDoubleSided && rack.sides.length === 1 && hasContent && (
        <mesh
          position={[rack.width / 2, 0, 0]}
          onClick={selectRack}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <boxGeometry args={[0.1, rackHeight, rack.depth]} />
          <meshStandardMaterial
            color="#FFFFFF"
            metalness={0.6}
            roughness={0.4}
            emissive={hovered ? "#3498db" : "#000000"}
            emissiveIntensity={hovered ? 0.2 : 0}
          />
          <Edges color={hovered ? "#3498db" : "#1a252f"} lineWidth={2} />
        </mesh>
      )}

      {/* Render sides */}
      {rack.sides.map((side, sideIndex) => {
        // Double-sided gondola: both sides share the center spine, face opposite
        // directions (open along ±Z). Single-sided: one face only.
        const sideX = isDoubleSided
          ? 0
          : rack.sides.length === 2
            ? sideIndex === 0
              ? -sideOffset
              : sideOffset
            : 0;
        const sideRotationY = isDoubleSided && sideIndex === 1 ? Math.PI : 0;
        const numSides = rack.sides.length;
        const rowWidth = isDoubleSided
          ? rack.width * 0.9
          : (rack.width / numSides) * 0.85;
        const rowDepth = isDoubleSided ? rack.depth * 0.5 : rack.depth * 0.9;
        const shelfOffsetZ = isDoubleSided ? -rowDepth / 2 : 0;

        const baseTopY = -rackHeight / 2 + 0.2;
        let currentY = baseTopY;
        const rowPositions: number[] = [];

        side.rows.forEach((row) => {
          rowPositions.push(currentY + row.height / 2);
          currentY += row.height;
        });

        return (
          <group
            key={side.sideId}
            position={[sideX, 0, 0]}
            rotation={[0, sideRotationY, 0]}
          >
            {side.rows.map((row, rowIndex) => (
              <Row
                key={row.id}
                row={row}
                position={[0, rowPositions[rowIndex], 0]}
                rackWidth={rowWidth}
                rackDepth={rowDepth}
                showBottomBorder={rowIndex < side.rows.length - 1}
                openBothSides={isDoubleSided}
                shelfOffsetZ={shelfOffsetZ}
              />
            ))}
          </group>
        );
      })}

      {/* Selection highlight – skip raycast so bins can be clicked */}
      {isSelected && (
        <mesh ref={meshRef} raycast={() => null}>
          <boxGeometry
            args={[rack.width + 0.3, rackHeight + 0.3, rack.depth + 0.3]}
          />
          <meshStandardMaterial
            color="#FFFFFF"
            transparent
            opacity={0.1}
            wireframe
          />
        </mesh>
      )}
    </group>
  );
}
