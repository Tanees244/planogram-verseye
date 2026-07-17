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



/** Hydrated POSM item on a rack surface (Company Assets). */

export interface RackSurfacePosm {

  id: string;

  name: string;

  posmType: 'Standee' | 'ShelfTalker' | 'Flyer' | string;

  imageUrl?: string | null;

  imageStorageKey?: string | null;

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

  headerPosmItemId?: string | null;

  footerPosmItemId?: string | null;

  leftWallPosmItemId?: string | null;

  rightWallPosmItemId?: string | null;

  headerPosm?: RackSurfacePosm | null;

  footerPosm?: RackSurfacePosm | null;

  leftWallPosm?: RackSurfacePosm | null;

  rightWallPosm?: RackSurfacePosm | null;

}



/** W×D footprint zone on a rack face (inner / outer lip). */

export interface ZoneFootprint {

  width: Meters | null;

  depth: Meters | null;

}



/** W×D×H volume zone (header / footer on a side). */

export interface ZoneVolume {

  width: Meters | null;

  depth: Meters | null;

  height: Meters | null;

}



export interface UpdateRackPosmItemsRequest {

  headerPosmItemId?: string | null;

  footerPosmItemId?: string | null;

  leftWallPosmItemId?: string | null;

  rightWallPosmItemId?: string | null;

  rowPosmItems?: Array<{ rowId: string; dividerPosmItemId: string | null }>;

}



export interface PosmItemListItem {

  id: string;

  name: string;

  posmType: string;

  assignedStoresLabel?: string;

  conditionStandards?: string;

  status: string;

  imageUrl?: string | null;

  imageStorageKey?: string | null;

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

  dividerThickness: Meters | null;

  dividerPosmItemId?: string | null;

  dividerPosm?: RackSurfacePosm | null;

  bins: BlueprintBin[];

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



export interface BlueprintSide {

  sideId: string;

  sideCode: string | null;

  depth: Meters | null;

  inner: ZoneFootprint | null;

  outer: ZoneFootprint | null;

  header: ZoneVolume | null;

  footer: ZoneVolume | null;

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


