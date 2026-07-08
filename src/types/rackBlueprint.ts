/** Rack blueprint contract types (Aisleris layout API). All dimensions in meters. */

export type Meters = number;

export interface Dimensions3 {
  width: Meters | null;
  depth: Meters | null;
  height: Meters | null;
}

export interface RackPlacement {
  position: { x: number; y: number; z: number } | null;
  rotation: { x: number; y: number; z: number } | null;
  snapMode: string | null;
  quadrant: string | null;
}

export interface HeaderFooterBand {
  enabled: boolean | null;
  width: Meters | null;
  depth: Meters | null;
  height: Meters | null;
  protrusion: Meters | null;
  color: string | null;
  emissive: string | null;
}

export interface RackShell {
  wallThickness: Meters;
  walls: { back: boolean; left: boolean; right: boolean; frontGlass: boolean };
  header: HeaderFooterBand;
  footer: HeaderFooterBand;
  frame: {
    cornerPosts: number | null;
    topRail: boolean | null;
    innerFloor: boolean | null;
  };
  materials: {
    accentColor: string | null;
    wallColor: string | null;
    postColor: string | null;
  };
}

export interface BinProduct {
  id: string | null;
  name: string;
  width: Meters;
  depth: Meters;
  height: Meters;
  weightKg: Meters | null;
  quantity: number;
  imageUrl: string | null;
}

export interface ShelfTalker {
  id: string;
  rackRowId?: string | null;
  label: string | null;
  length: Meters;
  innerDepth: Meters;
  outerHeight: Meters;
  slotPosition: number;
  placementZone: string | null;
}

export interface BlueprintBin {
  binId: string;
  binName: string | null;
  width: Meters | null;
  depth: Meters | null;
  height: Meters | null;
  xStart: Meters | null;
  xEnd: Meters | null;
  slotIndex: number | null;
  slotCount: number | null;
  products: BinProduct[];
}

export interface BlueprintRow {
  rowId: string;
  rowNumber: number | null;
  width: Meters | null;
  depth: Meters | null;
  height: Meters | null;
  yStart: Meters | null;
  yEnd: Meters | null;
  sided: string | null;
  span: Meters | null;
  dividerThickness: Meters;
  talkers: ShelfTalker[];
  bins: BlueprintBin[];
}

export interface BlueprintSide {
  sideId: string;
  sideCode: string | null;
  dimensions: {
    usableWidth: Meters | null;
    usableDepth: Meters | null;
    usableHeight: Meters | null;
  } | null;
  rows: BlueprintRow[];
}

export interface RackBlueprint {
  schemaVersion: '1.0';
  storeId: string;
  blueprintId: string;
  name: string | null;
  rack: {
    rackId: string;
    rackCode: string | null;
    fixtureType: string;
    placement: RackPlacement | null;
    outer: Dimensions3;
    shell: RackShell;
    inner: Dimensions3;
    layout: { sides: BlueprintSide[] };
  };
}

/** Enriched rack fields returned by structure / by-store endpoints. */
export interface RackBlueprintFields {
  blueprintName?: string | null;
  fixtureType?: string;
  placement?: RackPlacement | null;
  outer?: Dimensions3 | null;
  shell?: RackShell | null;
  inner?: Dimensions3 | null;
}
