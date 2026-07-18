import type { Area, Bin, Product, Rack, RackSide, Row } from '@/store/planogramStore';
import { buildUpdateRackPayload, resolveRackInner, resolveRackOuter } from '@/utils/rackBlueprintMapper';

function serializeProduct(product: Product) {
  return {
    id: product.id,
    name: product.name,
    color: product.color,
    width: product.width,
    height: product.height,
    depth: product.depth,
    quantity: Math.max(1, Math.floor(Number(product.quantity) || 1)),
    brandName: product.brandName ?? null,
    categoryName: product.categoryName ?? null,
    imageUrl: product.imageUrl ?? null,
    modelUrl: product.modelUrl ?? null,
    modelStorageKey: product.modelStorageKey ?? null,
    position:
      product.position !== null && product.position !== undefined
        ? { x: product.position.x, y: product.position.y }
        : null,
  };
}

function serializeBin(bin: Bin) {
  return {
    id: bin.id,
    binName: bin.binName ?? null,
    width: bin.width,
    depth: bin.depth,
    height: bin.height,
    products: bin.products.map(serializeProduct),
  };
}

function serializeRow(row: Row, rowNumber: number) {
  return {
    id: row.id,
    rowNumber,
    height: row.height,
    width: row.width ?? row.span ?? null,
    span: row.span ?? row.width ?? null,
    dividerThickness: row.dividerThickness ?? null,
    dividerPosmItemId: row.dividerPosmItemId ?? null,
    sided: row.sided ?? 'one',
    yStart: row.yStart ?? null,
    yEnd: row.yEnd ?? null,
    bins: row.bins.map(serializeBin),
  };
}

function serializeSide(side: RackSide, sideIndex: number) {
  return {
    id: side.id,
    sideId: side.sideId,
    sideCode: side.sideCode,
    depth: side.depth ?? null,
    inner: side.inner ?? null,
    outer: side.outer ?? null,
    header: side.header ?? null,
    footer: side.footer ?? null,
    rows: side.rows.map((row, idx) => serializeRow(row, idx + 1)),
    sideIndex: sideIndex + 1,
  };
}

/** Canonical rack payload for PLM export (meters, full nested tree). */
export function serializeRackForExport(rack: Rack): Record<string, unknown> {
  const outer = resolveRackOuter(rack);
  const inner = resolveRackInner(rack);
  const apiPayload = buildUpdateRackPayload(rack);

  return {
    ...apiPayload,
    outer,
    inner,
    position: rack.position,
    rotation: rack.rotation ?? { x: 0, y: 0, z: 0 },
    quadrant: rack.quadrant ?? null,
    customConfig: rack.customConfig ?? null,
    sides: rack.sides.map((side, idx) => serializeSide(side, idx)),
  };
}

export function summarizeRacks(racks: Rack[]) {
  let rows = 0;
  let bins = 0;
  let products = 0;
  let facings = 0;

  for (const rack of racks) {
    for (const side of rack.sides) {
      rows += side.rows.length;
      for (const row of side.rows) {
        bins += row.bins.length;
        for (const bin of row.bins) {
          products += bin.products.length;
          for (const product of bin.products) {
            facings += Math.max(1, Math.floor(Number(product.quantity) || 1));
          }
        }
      }
    }
  }

  return { racks: racks.length, rows, bins, products, facings };
}

export function boundsFromRacks(racks: Rack[], paddingM = 10): Pick<Area, 'width' | 'depth'> {
  if (racks.length === 0) return { width: 50, depth: 50 };

  let maxDistX = 30;
  let maxDistZ = 30;

  for (const rack of racks) {
    const corners = [
      { x: rack.position.x - rack.width / 2, z: rack.position.z - rack.depth / 2 },
      { x: rack.position.x + rack.width / 2, z: rack.position.z - rack.depth / 2 },
      { x: rack.position.x - rack.width / 2, z: rack.position.z + rack.depth / 2 },
      { x: rack.position.x + rack.width / 2, z: rack.position.z + rack.depth / 2 },
    ];
    for (const corner of corners) {
      maxDistX = Math.max(maxDistX, Math.abs(corner.x));
      maxDistZ = Math.max(maxDistZ, Math.abs(corner.z));
    }
  }

  return {
    width: maxDistX * 2 + paddingM,
    depth: maxDistZ * 2 + paddingM,
  };
}
