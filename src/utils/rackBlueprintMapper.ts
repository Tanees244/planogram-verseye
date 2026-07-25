import type { CustomRackConfig } from '@/components/fixtures/customRackTypes';
import { computeCustomRackDimensions } from '@/components/fixtures/customRackTypes';
import type { FixtureType } from '@/components/fixtures/types';
import { FIXTURE_LIBRARY } from '@/components/fixtures/types';
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
    isDoubleSided: false,
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
    const dims = computeCustomRackDimensions(cfg);
    const inner = {
      width: dims.innerWidth,
      depth: dims.innerDepth,
      height: dims.innerHeight,
    };
    return {
      storeId,
      rackCode,
      blueprintName: options.blueprintName ?? rackCode,
      fixtureType: 'CUSTOM',
      isDoubleSided,
      outer,
      inner,
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
    blueprintName: options.blueprintName ?? rackCode,
    fixtureType: fixtureType ?? 'GONDOLA',
    isDoubleSided,
    width,
    depth,
    height: options.outerHeight ?? FIXTURE_LIBRARY[fixtureType]?.defaultHeight ?? depth,
    outer: {
      width,
      depth,
      height: options.outerHeight ?? FIXTURE_LIBRARY[fixtureType]?.defaultHeight ?? depth,
    },
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
    // Read URLs may be short-lived presigned links. The API resolves the
    // catalog image again, so never persist that URL as product state.
    imageUrl: null,
    ...(product.position !== null && product.position !== undefined
      ? {
          position: {
            x: product.position.x,
            y: product.position.y,
          },
        }
      : {}),
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
    ...(bin.itemTagPosmItemId
      ? { itemTagPosmItemId: bin.itemTagPosmItemId }
      : {}),
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
    // Keep the row's own usable depth (per-side, e.g. 0.55 on a double-sided
    // gondola) — falling back to rack inner depth would inflate it to the
    // full cavity and break the API's bin-depth rule.
    depth: Number(row.depth) > 0 ? Number(row.depth) : rowDepth,
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
  const hasInner =
    rack.inner &&
    (Number(rack.inner.width) > 0 || Number(rack.inner.depth) > 0 || Number(rack.inner.height) > 0);

  if (hasInner) {
    // Prefer explicit inner axes. When depth is missing, prefer a side inner/depth
    // over outer×0.9 — freezers/cabinets often report outer depth much larger than
    // the usable cavity the API enforces (e.g. 0.99 outer vs 0.55 inner).
    let depthFallback = rack.depth * 0.9;
    for (const side of rack.sides ?? []) {
      const sideInnerD = Number(side.inner?.depth);
      if (Number.isFinite(sideInnerD) && sideInnerD > 0) {
        depthFallback = sideInnerD;
        break;
      }
      const sideD = Number(side.depth);
      if (Number.isFinite(sideD) && sideD > 0) {
        depthFallback = sideD;
        break;
      }
    }
    return {
      width: num(rack.inner?.width, rack.width * 0.85),
      depth: num(rack.inner?.depth, depthFallback),
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
  let depth = Math.max(0.1, rack.depth - wallT * 2);
  for (const side of rack.sides ?? []) {
    const sideInnerD = Number(side.inner?.depth);
    if (Number.isFinite(sideInnerD) && sideInnerD > 0) {
      depth = sideInnerD;
      break;
    }
    const sideD = Number(side.depth);
    if (Number.isFinite(sideD) && sideD > 0) {
      depth = sideD;
      break;
    }
  }
  return {
    width: Math.max(0.1, rack.width - wallT * 2),
    depth,
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

/** Max bin depth allowed by API = rack/side inner cavity depth. */
export function clampBinDepthToInner(
  rack: Rack,
  requested?: number | null,
  rowId?: string | null,
): number {
  const max = maxBinDepthM(rack, rowId);
  if (requested == null || !Number.isFinite(requested) || requested <= 0) return max;
  return Math.min(requested, max);
}

/** Usable bin depth ceiling in meters (inner cavity, with float epsilon). */
export function maxBinDepthM(rack: Rack, rowId?: string | null): number {
  let limit = 0;

  if (rowId) {
    for (const side of rack.sides) {
      const row = side.rows.find((r) => r.id === rowId);
      if (!row) continue;

      // API available depth is the tightest of row / side depth. Prefer side.depth
      // as a hard ceiling — row.depth can be wrongly set to outer/cavity depth
      // (e.g. 0.98) while the API only allows ~0.55 (side.depth).
      // Never use side.inner.depth alone: on double-sided gondolas it is the
      // full cavity across both faces.
      const rowD = Number(row.depth);
      const sideD = Number(side.depth);
      const candidates: number[] = [];
      if (Number.isFinite(sideD) && sideD > 0) candidates.push(sideD);
      if (Number.isFinite(rowD) && rowD > 0) candidates.push(rowD);
      if (candidates.length > 0) {
        limit = Math.min(...candidates);
      } else {
        const sideInnerD = Number(side.inner?.depth);
        if (Number.isFinite(sideInnerD) && sideInnerD > 0) limit = sideInnerD;
      }

      // Existing bins already accepted by the API are a reliable ceiling too.
      for (const bin of row.bins) {
        const d = Number(bin.depth);
        if (Number.isFinite(d) && d > 0) {
          limit = limit > 0 ? Math.min(limit, d) : d;
        }
      }
      break;
    }
  }

  if (!(limit > 0)) {
    // No row context — the smallest side depth is the safest ceiling.
    for (const side of rack.sides ?? []) {
      const sideD = Number(side.depth);
      if (Number.isFinite(sideD) && sideD > 0) {
        limit = limit > 0 ? Math.min(limit, sideD) : sideD;
      }
    }
  }

  if (!(limit > 0)) {
    limit = resolveRackInner(rack).depth;
  }

  return Math.max(0.05, limit - 0.001);
}

/** Max bin height allowed by API ≈ row height (with small clearance). */
export function clampBinHeightToRow(rowHeight: number, requested?: number | null): number {
  const max = Math.max(0.05, rowHeight - 0.05);
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
  // Always derive placement from the rack's *current* position/rotation.
  // rack.placement can be stale (set at creation, not synced on later moves),
  // and sending it would teleport the rack back on the next reload.
  const placement: RackPlacement = {
    position: { ...rack.position },
    rotation: rack.rotation ? { ...rack.rotation } : { x: 0, y: 0, z: 0 },
    snapMode: rack.placement?.snapMode ?? 'wall',
    quadrant: rack.quadrant ?? rack.placement?.quadrant ?? null,
  };
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
    // Top-level placement mirrors (API accepts both nested + flat fields).
    positionX: placement.position?.x ?? rack.position.x,
    positionY: placement.position?.y ?? rack.position.y ?? 0,
    positionZ: placement.position?.z ?? rack.position.z,
    rotationY: placement.rotation?.y ?? rack.rotation?.y ?? 0,
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

/** Placement-only PUT body — used after move/rotate so face-fill rules do not block. */
export function buildUpdateRackPlacementPayload(rack: Rack): Record<string, unknown> {
  const serverRackId = rack.rackId || rack.id;
  const position = { ...rack.position };
  const rotation = rack.rotation ? { ...rack.rotation } : { x: 0, y: 0, z: 0 };
  return {
    rackId: serverRackId,
    positionX: position.x,
    positionY: position.y ?? 0,
    positionZ: position.z,
    rotationY: rotation.y ?? 0,
    placement: {
      position,
      rotation,
      snapMode: rack.placement?.snapMode ?? 'wall',
      quadrant: rack.quadrant ?? rack.placement?.quadrant ?? null,
    },
  };
}
