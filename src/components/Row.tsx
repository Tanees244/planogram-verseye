// @ts-nocheck
"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Mesh, Object3D } from "three";
import { Edges } from "@react-three/drei";
import { Row as RowType, usePlanogramStore } from "@/store/planogramStore";
import { Bin } from "./Bin";
import { ProductPlacementPreview } from "./ProductPlacementPreview";
import { safeDim } from "@/utils/safeDimensions";
import {
  binDimsForPack,
  findRowPlacementContext,
  inferPlacementAnchor,
  remainingRowFillPlan,
} from "@/utils/productRowPlacement";
import { packFacingsInBin, type FacingPackSlot } from "@/utils/facingPack";
import { resolveIsStackable } from "@/utils/stackableSku";
import { heroPlacementBlockedOnRow } from "@/utils/heroSku";

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

/** Place a bin so its front face sits on the shopper-facing shelf lip. */
function frontAlignedShelfZ(shelfCenterZ: number, shelfDepth: number, binDepth: number) {
  const lipInset = 0.04
  return shelfCenterZ - shelfDepth / 2 + lipInset + binDepth / 2
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
  const {
    selectedId,
    setSelected,
    pendingBinPreview,
    isPlacingProduct,
    pendingProductParams,
    productPlacementDraft,
    productDropHover,
    setProductPlacementTarget,
    setProductDropHover,
    selectedType,
    area,
  } = usePlanogramStore();

  const isSelected = selectedId === row.id;
  const binPreview =
    pendingBinPreview?.rowId === row.id ? pendingBinPreview : null;
  const placing = isPlacingProduct && Boolean(pendingProductParams);
  const draftOnThisRow = productPlacementDraft?.rowId === row.id;
  const hoverOnThisRow = productDropHover?.rowId === row.id;
  const rackRestrict =
    placing && selectedType === "rack" && selectedId
      ? area.racks.some(
          (r) =>
            r.id === selectedId &&
            r.sides.some((s) => s.rows.some((rw) => rw.id === row.id)),
        )
      : true;
  const acceptPlacement =
    placing && (selectedType !== "rack" || rackRestrict);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(isSelected || draftOnThisRow ? 1.03 : 1);
    }
  });

  const rowHeight = safeDim(row.height, 1.5);
  const safeRackWidth = safeDim(rackWidth, 1);
  const safeRackDepth = safeDim(rackDepth, 1);
  const borderThickness = 0.08;
  const z = shelfOffsetZ;

  const [hovered, setHovered] = useState(false);

  const placementGhost = useMemo(() => {
    if (!pendingProductParams) return null;
    if (!draftOnThisRow && !hoverOnThisRow) return null;
    const ctx = findRowPlacementContext(area.racks, row.id);
    if (!ctx) return null;
    const facings = draftOnThisRow ? productPlacementDraft!.facings : 1;
    const depthRows = draftOnThisRow ? productPlacementDraft!.depth : 1;
    const stack = draftOnThisRow ? productPlacementDraft!.stack : 1;
    const anchor = draftOnThisRow
      ? (productPlacementDraft!.anchor ?? 'left')
      : (productDropHover?.anchor ?? 'left');
    const stackable = resolveIsStackable(pendingProductParams.id, {
      isStackable: pendingProductParams.isStackable,
    });
    const packSized = binDimsForPack(
      pendingProductParams,
      facings,
      depthRows,
      stackable ? stack : 1,
      ctx.remainingWidth,
      ctx.availableDepth,
      ctx.rowHeight,
    );
    const fillRemaining = draftOnThisRow && productPlacementDraft!.fillRemaining === true;
    const fillPlan = fillRemaining
      ? remainingRowFillPlan(
          pendingProductParams,
          { facings, depth: depthRows, stack: stackable ? stack : 1 },
          ctx.remainingWidth,
          ctx.availableDepth,
          ctx.rowHeight,
          true,
        )
      : null;
    const sized = fillPlan
      ? {
          width: fillPlan.width,
          depth: fillPlan.depth,
          height: fillPlan.height,
          fits: packSized.fits,
        }
      : packSized;
    const qty = fillPlan
      ? fillPlan.quantity
      : Math.max(1, facings) *
        Math.max(1, depthRows) *
        Math.max(1, stackable ? stack : 1);
    const pack = packFacingsInBin({
      binWidth: sized.width,
      binHeight: sized.height,
      binDepth: sized.depth,
      facing: {
        width: pendingProductParams.width,
        height: pendingProductParams.height,
        depth: pendingProductParams.depth,
      },
      quantity: qty,
      packOrder: stackable ? 'stackFirst' : 'depthFirst',
      align: fillRemaining ? 'left' : anchor,
      stackable,
      visualLimit: qty,
    });
    return { sized, pack, fits: sized.fits };
  }, [
    pendingProductParams,
    draftOnThisRow,
    hoverOnThisRow,
    productPlacementDraft,
    productDropHover,
    area.racks,
    row.id,
    row.bins,
  ]);

  const selectRow = (e: any) => {
    e.stopPropagation();
    if (placing && acceptPlacement) {
      const local = e.object.worldToLocal(e.point.clone());
      const anchor = inferPlacementAnchor(local.x, safeRackWidth, row.bins);
      const res = setProductPlacementTarget(row.id, { anchor });
      if (!res.success && res.message) {
        usePlanogramStore.setState({ addProductError: res.message });
      }
      return;
    }
    setSelected(row.id, "row");
  };

  const updatePlacementHover = (active: boolean, anchor?: 'left' | 'right') => {
    if (!placing || !pendingProductParams || !acceptPlacement) return;
    if (!active) {
      if (productDropHover?.rowId === row.id && !draftOnThisRow) {
        setProductDropHover(null);
      }
      return;
    }
    const ctx = findRowPlacementContext(area.racks, row.id);
    if (!ctx) {
      setProductDropHover({
        rowId: row.id,
        fits: false,
        reason: "Shelf not found",
      });
      return;
    }
    const sized = binDimsForPack(
      pendingProductParams,
      1,
      1,
      1,
      ctx.remainingWidth,
      ctx.availableDepth,
      ctx.rowHeight,
    );
    const heroBlock = heroPlacementBlockedOnRow(
      pendingProductParams.id,
      row.id,
      area.racks,
      { isHero: pendingProductParams.isHero },
    );
    setProductDropHover({
      rowId: row.id,
      fits: sized.fits && !heroBlock,
      reason: heroBlock || sized.reason,
      anchor: anchor ?? inferPlacementAnchor(0, safeRackWidth, row.bins),
    });
  };

  const rowHoverProps = {
    onPointerOver: (e: any) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = placing ? "copy" : "pointer";
      const local = e.object.worldToLocal(e.point.clone());
      updatePlacementHover(true, inferPlacementAnchor(local.x, safeRackWidth, row.bins));
    },
    onPointerMove: (e: any) => {
      if (!placing || !acceptPlacement) return;
      e.stopPropagation();
      const local = e.object.worldToLocal(e.point.clone());
      const next = inferPlacementAnchor(local.x, safeRackWidth, row.bins);
      if (productDropHover?.rowId === row.id && productDropHover.anchor === next) return;
      updatePlacementHover(true, next);
    },
    onPointerOut: () => {
      setHovered(false);
      document.body.style.cursor = "default";
      updatePlacementHover(false);
    },
  };

  const highlightPlacement =
    placing && acceptPlacement && (hovered || draftOnThisRow || hoverOnThisRow);
  const placementOk =
    draftOnThisRow
      ? productPlacementDraft?.previewFits !== false
      : productDropHover?.rowId === row.id
        ? productDropHover.fits
        : true;

  return (
    <group position={position} userData={{ id: row.id, type: 'row' }}>
      {/* Hitbox at back – for clicks from behind the rack */}
      <mesh
        userData={{ id: row.id, type: 'row' }}
        position={[0, 0, z]}
        onClick={selectRow}
        {...rowHoverProps}
        renderOrder={8}
      >
        <boxGeometry args={[safeRackWidth, Math.max(rowHeight * 0.92, 0.2), Math.max(safeRackDepth * 0.9, 0.2)]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

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
      {/* Floor of the slot – click empty shelf areas to select row / place SKU */}
      <mesh
        ref={meshRef}
        userData={{ id: row.id, type: 'row' }}
        position={[0, -rowHeight / 2 + 0.03, z]}
        onClick={selectRow}
        {...rowHoverProps}
      >
        <boxGeometry args={[safeRackWidth, 0.06, safeRackDepth]} />
        <meshStandardMaterial
          color="#FFFFFF"
          metalness={0.35}
          roughness={0.55}
          emissive={
            highlightPlacement
              ? placementOk
                ? "#059669"
                : "#dc2626"
              : hovered
                ? "#2C5282"
                : "#000000"
          }
          emissiveIntensity={highlightPlacement || hovered ? 0.35 : 0}
        />
        <Edges
          scale={1}
          threshold={15}
          color={
            highlightPlacement
              ? placementOk
                ? "#10b981"
                : "#ef4444"
              : isSelected
                ? "#2ecc71"
                : hovered
                  ? "#2C5282"
                  : "#7f8c8d"
          }
          lineWidth={isSelected || highlightPlacement ? 2.5 : 2}
        />
      </mesh>
      {/* Visible front lip */}
      <mesh
        position={[0, -rowHeight / 2 + 0.06, z - safeRackDepth / 2]}
        raycast={() => null}
      >
        <boxGeometry args={[safeRackWidth, 0.08, 0.06]} />
        <meshStandardMaterial color="#34495e" metalness={0.5} roughness={0.4} />
      </mesh>
      {/*
        Dedicated row hit strip in front of bins/products.
        depthTest=false so the strip stays clickable even when bins fill the shelf.
      */}
      <mesh
        userData={{ id: row.id, type: 'row' }}
        position={[0, -rowHeight / 2 + 0.1, z - safeRackDepth / 2 - 0.07]}
        onClick={selectRow}
        {...rowHoverProps}
        renderOrder={20}
      >
        <boxGeometry args={[safeRackWidth, Math.min(0.28, rowHeight * 0.45), 0.14]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
        />
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

      {/* Bins inside the row – left-anchored from the left, right-anchored from the right */}
      {(() => {
        const maxBinH = Math.max(0.08, rowHeight - 0.08)
        const anyBinTag = row.bins.some((b) => b.itemTagPosm || b.itemTagPosmItemId)
        const SHELF_BOARD_H = 0.05
        const n = Math.max(row.bins.length, 1)
        const fallbackWidth = safeRackWidth / n

        const binMetrics = (bin: (typeof row.bins)[number]) => {
          const slotWidth = Math.min(safeDim(bin.width, fallbackWidth), safeRackWidth)
          const binDepth = Math.min(safeDim(bin.depth, safeRackDepth), safeRackDepth * 0.95)
          const rawBinH = safeDim(bin.height, maxBinH)
          const binHeightUse =
            rawBinH <= SHELF_BOARD_H ? maxBinH : Math.min(rawBinH, maxBinH)
          return { slotWidth, binDepth, binHeightUse }
        }

        let xLeft = -safeRackWidth / 2
        let xRight = safeRackWidth / 2
        const existing = row.bins.map((bin, binIndex) => {
          const { slotWidth, binDepth, binHeightUse } = binMetrics(bin)
          let xOffset: number
          if (bin.anchor === 'right') {
            xRight -= slotWidth
            xOffset = xRight + slotWidth / 2
          } else {
            xOffset = xLeft + slotWidth / 2
            xLeft += slotWidth
          }
          const binY = -rowHeight / 2 + binHeightUse / 2 + 0.03
          const binZ = frontAlignedShelfZ(z, safeRackDepth, binDepth)
          const legacyFallback =
            !anyBinTag && binIndex === 0 ? row.dividerPosm : null
          return (
            <Bin
              key={bin.id}
              bin={bin}
              rowId={row.id}
              position={[xOffset, binY, binZ]}
              binHeight={binHeightUse}
              binDepth={binDepth}
              binWidth={slotWidth}
              fallbackPosm={legacyFallback}
            />
          )
        })

        let ghost = null
        if (binPreview) {
          const previewW = Math.min(
            safeDim(binPreview.width, safeRackWidth * 0.25),
            Math.max(0.05, xRight - xLeft + 0.001),
            safeRackWidth,
          )
          const previewD = Math.min(safeDim(binPreview.depth, safeRackDepth * 0.9), safeRackDepth * 0.95)
          const rawH = safeDim(binPreview.height, maxBinH)
          const previewH =
            rawH <= 0.05 ? maxBinH : Math.min(rawH, maxBinH)
          const gx = xLeft + previewW / 2
          const gy = -rowHeight / 2 + previewH / 2 + 0.03
          const gz = frontAlignedShelfZ(z, safeRackDepth, previewD)
          const overflows = gx + previewW / 2 > xRight + 0.002
          ghost = (
            <group position={[gx, gy, gz]} raycast={() => null}>
              <mesh>
                <boxGeometry args={[previewW, previewH, previewD]} />
                <meshStandardMaterial
                  color={overflows ? "#ef4444" : "#2C5282"}
                  transparent
                  opacity={0.35}
                  depthWrite={false}
                />
                <Edges color={overflows ? "#b91c1c" : "#1e3a5f"} />
              </mesh>
            </group>
          )
        }

        let skuGhost = null
        if (placementGhost && pendingProductParams) {
          const { sized, pack, fits } = placementGhost
          const previewW = Math.min(
            sized.width,
            Math.max(0.05, xRight - xLeft + 0.001),
          )
          const previewD = Math.min(sized.depth, safeRackDepth * 0.95)
          const previewH = Math.min(sized.height, Math.max(0.08, rowHeight - 0.08))
          const fromRight =
            !(draftOnThisRow && productPlacementDraft?.fillRemaining === true) &&
            (draftOnThisRow
              ? productPlacementDraft?.anchor
              : productDropHover?.anchor) === 'right'
          const gx = fromRight
            ? xRight - previewW / 2
            : xLeft + previewW / 2
          const gy = -rowHeight / 2 + previewH / 2 + 0.03
          const gz = frontAlignedShelfZ(z, safeRackDepth, previewD)
          skuGhost = (
            <group position={[gx, gy, gz]} raycast={() => null}>
              <mesh>
                <boxGeometry args={[previewW, previewH, previewD]} />
                <meshStandardMaterial
                  color={fits ? "#059669" : "#ef4444"}
                  transparent
                  opacity={0.22}
                  depthWrite={false}
                />
                <Edges color={fits ? "#10b981" : "#b91c1c"} />
              </mesh>
              {pack.slots.length > 96 ? (
                <DensePackGhost
                  slots={pack.slots}
                  color={fits ? "#10b981" : "#ef4444"}
                />
              ) : (
                pack.slots.map((slot, index) => (
                  <ProductPlacementPreview
                    key={`row-place-ghost-${index}`}
                    position={[slot.x, slot.y, slot.z]}
                    width={slot.width}
                    height={slot.height}
                    depth={slot.depth}
                    fits={fits && !slot.overflow}
                    color={pendingProductParams.color ?? "#10b981"}
                    modelUrl={null}
                    modelStorageKey={null}
                  />
                ))
              )}
            </group>
          )
        }

        return (
          <>
            {existing}
            {ghost}
            {skuGhost}
          </>
        )
      })()}

    </group>
  );
}

/** One draw call for dense front×depth×stack placement previews. */
function DensePackGhost({
  slots,
  color,
}: {
  slots: FacingPackSlot[];
  color: string;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const avg = useMemo(() => {
    if (slots.length === 0) return { w: 0.08, h: 0.08, d: 0.08 };
    const n = slots.length;
    return {
      w: slots.reduce((s, x) => s + x.width, 0) / n,
      h: slots.reduce((s, x) => s + x.height, 0) / n,
      d: slots.reduce((s, x) => s + x.depth, 0) / n,
    };
  }, [slots]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || slots.length === 0) return;
    const dummy = new Object3D();
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      dummy.position.set(slot.x, slot.y, slot.z);
      dummy.scale.set(
        slot.width / Math.max(avg.w, 1e-6),
        slot.height / Math.max(avg.h, 1e-6),
        slot.depth / Math.max(avg.d, 1e-6),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = slots.length;
  }, [slots, avg.w, avg.h, avg.d]);

  if (slots.length === 0) return null;
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, slots.length]} raycast={() => null}>
      <boxGeometry args={[avg.w, avg.h, avg.d]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
