import type { CustomRackConfig } from '@/components/fixtures/customRackTypes';
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes';
import type { FixtureType } from '@/components/fixtures/types';
import type { Bin, Product, Quadrant, Rack, RackRotation, Row } from '@/store/planogramStore';
import type {
  Dimensions3,
  RackPlacement,
  RackShell,
  HeaderFooterBand,
} from '@/types/rackBlueprint';
import {
  DEFAULT_RACK_DEPTH,
  DEFAULT_RACK_WIDTH,
  GROCERY_SHELF_HEIGHT,
} from '@/constants/dimensions';
import { safeDim } from '@/utils/safeDimensions';

function num(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function bandFromSection(
  section: CustomRackConfig['header'],
): HeaderFooterBand {
  return {
    enabled: section.enabled,
    width: section.width > 0 ? section.width : null,
    depth: section.depth > 0 ? section.depth : null,
    height: section.height,
    protrusion: section.protrusion,
    color: section.color,
    emissive: section.emissive ?? null,
  };
}

function normalizeBandSpan(value: number, outerSpan: number, innerSpan?: number): number {
  if (value <= 0) return 0
  if (outerSpan > 0 && Math.abs(value - outerSpan) < 0.05) return 0
  if (innerSpan != null && innerSpan > 0 && Math.abs(value - innerSpan) < 0.05) return 0
  return value
}

function sectionFromBand(
  band: HeaderFooterBand | null | undefined,
  outer?: Dimensions3 | null,
  wallThickness = 0.08,
): CustomRackConfig['header'] {
  const ow = num(outer?.width, 0)
  const od = num(outer?.depth, 0)
  const iw = Math.max(0.1, ow - wallThickness * 2)
  const id = Math.max(0.1, od - wallThickness * 2)
  const rawW = band?.width != null ? num(band.width, 0) : 0
  const rawD = band?.depth != null ? num(band.depth, 0) : 0
  return {
    enabled: Boolean(band?.enabled),
    height: num(band?.height, 0.35),
    width: normalizeBandSpan(rawW, ow, iw),
    depth: normalizeBandSpan(rawD, od, id),
    protrusion: num(band?.protrusion, 0),
    color: band?.color ?? '#2C5282',
    emissive: band?.emissive ?? undefined,
  };
}

export function customConfigToShell(cfg: CustomRackConfig): RackShell {
  return {
    wallThickness: cfg.wallThickness,
    walls: { ...cfg.walls },
    header: bandFromSection(cfg.header),
    footer: bandFromSection(cfg.footer),
    frame: { cornerPosts: 4, topRail: true, innerFloor: true },
    materials: {
      accentColor: cfg.accentColor,
      wallColor: '#e8eaed',
      postColor: '#1a1a1a',
    },
  };
}

export function shellToCustomConfig(
  shell: RackShell | null | undefined,
  outer: Dimensions3 | null | undefined,
  preset: CustomRackConfig['preset'] = 'CUSTOM',
): CustomRackConfig | undefined {
  if (!shell && !outer) return undefined;
  const ow = num(outer?.width, DEFAULT_RACK_WIDTH);
  const od = num(outer?.depth, DEFAULT_RACK_DEPTH);
  const oh = num(outer?.height, GROCERY_SHELF_HEIGHT);
  const wt = num(shell?.wallThickness, 0.08);
  return {
    preset,
    outerWidth: ow,
    outerDepth: od,
    outerHeight: oh,
    wallThickness: wt,
    header: sectionFromBand(shell?.header, outer, wt),
    footer: sectionFromBand(shell?.footer, outer, wt),
    walls: shell?.walls ?? { back: true, left: true, right: true, frontGlass: false },
    shelfCount: 0,
    shelfThickness: 0.03,
    accentColor: shell?.materials?.accentColor ?? '#2C5282',
  };
}

export function parsePlacement(raw: Record<string, unknown>): RackPlacement | null {
  const placement = raw.placement as Record<string, unknown> | null | undefined;
  if (placement && typeof placement === 'object') {
    const pos = placement.position as Record<string, number> | null | undefined;
    const rot = placement.rotation as Record<string, number> | null | undefined;
    return {
      position: pos
        ? { x: num(pos.x, 0), y: num(pos.y, 0), z: num(pos.z, 0) }
        : null,
      rotation: rot
        ? { x: num(rot.x, 0), y: num(rot.y, 0), z: num(rot.z, 0) }
        : null,
      snapMode: (placement.snapMode as string) ?? null,
      quadrant: (placement.quadrant as string) ?? null,
    };
  }

  const legacyPos = raw.position as Record<string, number> | null | undefined;
  if (legacyPos && typeof legacyPos === 'object') {
    return {
      position: {
        x: num(legacyPos.x, 0),
        y: num(legacyPos.y, 0),
        z: num(legacyPos.z, 0),
      },
      rotation: {
        x: 0,
        y: num(legacyPos.rotationY, num(raw.rotationY, 0)),
        z: 0,
      },
      snapMode: null,
      quadrant: (raw.quadrant as string) ?? null,
    };
  }

  if (
    raw.positionX != null ||
    raw.positionY != null ||
    raw.positionZ != null ||
    raw.rotationY != null
  ) {
    return {
      position: {
        x: num(raw.positionX, 0),
        y: num(raw.positionY, 0),
        z: num(raw.positionZ, 0),
      },
      rotation: { x: 0, y: num(raw.rotationY, 0), z: 0 },
      snapMode: null,
      quadrant: (raw.quadrant as string) ?? null,
    };
  }

  return null;
}

export function placementToRotation(placement: RackPlacement | null | undefined): RackRotation {
  const rot = placement?.rotation;
  return {
    x: num(rot?.x, 0),
    y: num(rot?.y, 0),
    z: num(rot?.z, 0),
  };
}

export function placementToPosition(
  placement: RackPlacement | null | undefined,
): { x: number; y: number; z: number } {
  const pos = placement?.position;
  return { x: num(pos?.x, 0), y: num(pos?.y, 0), z: num(pos?.z, 0) };
}

export function rackToPlacement(rack: Rack): RackPlacement {
  return {
    position: { ...rack.position },
    rotation: rack.rotation ? { ...rack.rotation } : { x: 0, y: 0, z: 0 },
    snapMode: 'wall',
    quadrant: rack.quadrant ?? null,
  };
}

export interface CreateRackBlueprintPayload {
  storeId: string;
  rackCode: string;
  blueprintName?: string;
  fixtureType: string;
  isDoubleSided: boolean;
  outer: { width: number; depth: number; height: number };
  shell: RackShell;
  placement: RackPlacement;
  /** Legacy flat fields kept for backward compatibility. */
  width: number;
  depth: number;
  height: number;
}

export function buildCreateRackPayload(options: {
  storeId: string;
  rackCode: string;
  blueprintName?: string;
  fixtureType: FixtureType;
  isDoubleSided: boolean;
  width: number;
  depth: number;
  outerHeight?: number;
  customConfig?: CustomRackConfig;
  placement: RackPlacement;
}): CreateRackBlueprintPayload | Record<string, unknown> {
  const { storeId, rackCode, fixtureType, isDoubleSided, width, depth, placement } = options;

  if (options.customConfig && fixtureType === 'CUSTOM') {
    const cfg = options.customConfig;
    const outer = {
      width: cfg.outerWidth,
      depth: cfg.outerDepth,
      height: cfg.outerHeight,
    };
    return {
      storeId,
      rackCode,
      blueprintName: options.blueprintName ?? rackCode,
      fixtureType: 'CUSTOM',
      isDoubleSided,
      outer,
      shell: customConfigToShell(cfg),
      placement,
      width: outer.width,
      depth: outer.depth,
      height: outer.height,
    };
  }

  return {
    storeId,
    rackCode,
    fixtureType: fixtureType ?? 'GONDOLA',
    isDoubleSided,
    width,
    depth,
    height: options.outerHeight ?? depth,
    placement,
    positionX: placement.position?.x ?? 0,
    positionY: placement.position?.y ?? 0,
    positionZ: placement.position?.z ?? 0,
    rotationY: placement.rotation?.y ?? 0,
  };
}

export function resolveRackDimensions(raw: Record<string, unknown>): {
  width: number;
  depth: number;
  outerHeight: number;
} {
  const outer = raw.outer as Dimensions3 | null | undefined;
  if (outer && (outer.width != null || outer.depth != null || outer.height != null)) {
    return {
      width: safeDim(outer.width, safeDim(raw.width, DEFAULT_RACK_WIDTH)),
      depth: safeDim(outer.depth, safeDim(raw.depth ?? raw.rackDepth, DEFAULT_RACK_DEPTH)),
      outerHeight: safeDim(outer.height, safeDim(raw.height, GROCERY_SHELF_HEIGHT)),
    };
  }
  return {
    width: safeDim(raw.width, DEFAULT_RACK_WIDTH),
    depth: safeDim(raw.depth ?? raw.rackDepth, DEFAULT_RACK_DEPTH),
    outerHeight: safeDim(raw.height, GROCERY_SHELF_HEIGHT),
  };
}

export function parseQuadrant(value: unknown): Quadrant | undefined {
  const q = typeof value === 'string' ? value.toUpperCase() : '';
  if (q === 'NW' || q === 'NE' || q === 'SW' || q === 'SE') return q;
  return undefined;
}

const SERVER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isServerUuid(id: string | undefined | null): boolean {
  return Boolean(id && SERVER_UUID_RE.test(id));
}

function productIdForApi(id: string): string | null {
  const base = id.split('::')[0];
  return isServerUuid(base) ? base : null;
}

function mapProductForApi(product: Product) {
  const apiId = productIdForApi(product.id);
  return {
    ...(apiId ? { id: apiId } : {}),
    name: product.name,
    width: product.width,
    depth: product.depth,
    height: product.height,
    quantity: Math.max(1, Math.floor(Number(product.quantity) || 1)),
    imageUrl: product.imageUrl ?? null,
    weightKg: null,
  };
}

function mapBinForApi(bin: Bin, slotIndex: number, slotCount: number, xStart: number) {
  const apiId = isServerUuid(bin.id) ? bin.id : undefined;
  const xEnd = xStart + bin.width;
  return {
    ...(apiId ? { id: apiId } : {}),
    binName: bin.binName ?? null,
    width: bin.width,
    depth: bin.depth,
    height: bin.height,
    slotIndex,
    slotCount,
    xStart,
    xEnd,
    products: bin.products.map(mapProductForApi),
  };
}

function mapRowForApi(
  row: Row,
  rowNumber: number,
  innerWidth: number,
  rowDepth: number,
  yStart: number,
) {
  const rowWidth = row.width ?? row.span ?? innerWidth;
  const apiId = isServerUuid(row.id) ? row.id : undefined;
  const yEnd = yStart + row.height;
  const slotCount = row.bins.length;
  const dividerThickness = row.dividerThickness ?? 0.025;

  let x = 0;
  const bins = row.bins.map((bin, slotIndex) => {
    const mapped = mapBinForApi(bin, slotIndex, slotCount, x);
    x += bin.width;
    return mapped;
  });

  const rowPayload: Record<string, unknown> = {
    ...(apiId ? { id: apiId } : {}),
    rowNumber,
    width: rowWidth,
    span: rowWidth,
    height: row.height,
    depth: rowDepth,
    sided: row.sided ?? 'one',
    dividerThickness,
    yStart,
    yEnd,
    bins,
  };

  if (row.dividerPosmItemId) {
    rowPayload.dividerPosmItemId = row.dividerPosmItemId;
  }

  return rowPayload;
}

export function resolveRackOuter(rack: Rack): { width: number; depth: number; height: number } {
  if (rack.customConfig) {
    return {
      width: rack.customConfig.outerWidth,
      depth: rack.customConfig.outerDepth,
      height: rack.customConfig.outerHeight,
    };
  }
  if (rack.outer?.width != null || rack.outer?.depth != null) {
    return {
      width: num(rack.outer?.width, rack.width),
      depth: num(rack.outer?.depth, rack.depth),
      height: num(rack.outer?.height, num(rack.height, rack.depth)),
    };
  }
  return {
    width: rack.width,
    depth: rack.depth,
    height: num(rack.height, rack.depth),
  };
}

/** Max row span/width allowed by API = rack inner cavity width. */
export function resolveRackInner(rack: Rack): { width: number; depth: number; height: number } {
  if (rack.inner?.width != null && Number(rack.inner.width) > 0) {
    return {
      width: num(rack.inner.width, rack.width * 0.85),
      depth: num(rack.inner?.depth, rack.depth * 0.9),
      height: num(rack.inner?.height, 2),
    };
  }
  if (rack.customConfig) {
    const d = computeCustomRackDimensions(rack.customConfig);
    return { width: d.innerWidth, depth: d.innerDepth, height: d.innerHeight };
  }
  // Fallback when shell/inner missing: assume default wall thickness 0.08m each side
  // (matches backend default so span validates: outer − 2×0.08)
  const wallT = num(rack.shell?.wallThickness, 0.08);
  return {
    width: Math.max(0.1, rack.width - wallT * 2),
    depth: Math.max(0.1, rack.depth - wallT * 2),
    height: 2,
  };
}

/** Clamp a requested row width/span to the rack inner width (API validation). */
export function clampRowSpanToInner(rack: Rack, requested?: number | null): number {
  const inner = resolveRackInner(rack);
  // Tiny epsilon so floating point doesn't trip "exceeds available space"
  const max = Math.max(0.1, inner.width - 0.001);
  if (requested == null || !Number.isFinite(requested) || requested <= 0) return max;
  return Math.min(requested, max);
}

/** Builds the nested PUT /api/v1/layout/racks/{rackId} body from local store state. */
export function buildUpdateRackPayload(
  rack: Rack,
  options?: { reflowSkus?: boolean },
): Record<string, unknown> {
  const serverRackId = rack.rackId || rack.id;
  const outer = resolveRackOuter(rack);
  const inner = resolveRackInner(rack);
  const placement = rack.placement ?? rackToPlacement(rack);
  const fixtureType = rack.fixtureType ?? 'GONDOLA';

  const payload: Record<string, unknown> = {
    rackId: serverRackId,
    rackCode: rack.rackCode,
    blueprintName: rack.blueprintName ?? rack.rackCode,
    fixtureType,
    isDoubleSided: Boolean(rack.isDoubleSided ?? rack.sides.length > 1),
    outer,
    inner,
    placement,
    width: outer.width,
    depth: outer.depth,
    height: outer.height,
    sides: rack.sides.map((side) => {
      const sideId = side.sideId || side.id;
      let y = 0;
      const rows = side.rows.map((row, idx) => {
        const mapped = mapRowForApi(row, idx + 1, inner.width, inner.depth, y);
        y += row.height;
        return mapped;
      });
      const sidePayload: Record<string, unknown> = {
        ...(isServerUuid(sideId) ? { id: sideId } : {}),
        rows,
      };
      if (side.inner) sidePayload.inner = side.inner;
      if (side.outer) sidePayload.outer = side.outer;
      if (side.header) sidePayload.header = side.header;
      if (side.footer) sidePayload.footer = side.footer;
      if (side.depth != null) sidePayload.depth = side.depth;
      return sidePayload;
    }),
  };

  if (rack.customConfig || fixtureType === 'CUSTOM') {
    const shell = rack.customConfig
      ? customConfigToShell(rack.customConfig)
      : rack.shell;
    if (shell) {
      payload.shell = {
        ...shell,
        headerPosmItemId: rack.shell?.headerPosmItemId ?? null,
        footerPosmItemId: rack.shell?.footerPosmItemId ?? null,
        leftWallPosmItemId: rack.shell?.leftWallPosmItemId ?? null,
        rightWallPosmItemId: rack.shell?.rightWallPosmItemId ?? null,
      };
    }
  } else if (rack.shell) {
    payload.shell = rack.shell;
  }

  if (options?.reflowSkus) {
    payload.reflowSkus = true;
  }

  return payload;
}
