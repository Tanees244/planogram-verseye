import { create } from "zustand";
import { resolveEntityId, resolveProductFacingId } from "@/utils/storeLayoutLoader";
import type { FixtureType } from "@/components/fixtures/types";
import { FIXTURE_LIBRARY } from "@/components/fixtures/types";
import type { CustomRackConfig } from "@/components/fixtures/customRackTypes";
import type { Dimensions3, RackPlacement, RackShell, RackSurfacePosm, ZoneFootprint, ZoneVolume } from "@/types/rackBlueprint";
import {
  cloneCustomRackConfig,
  createBlankCustomRack,
  createEndCapPreset,
  createRefrigeratedPreset,
  normalizeSectionSpans,
} from "@/components/fixtures/customRackTypes";
import {
  getRotatedFootprintHalf,
  isRackInsideFloor,
  snapRackToWall,
} from "@/utils/rackPlacement";
import { buildCreateRackPayload, buildUpdateRackPayload, clampBinDepthToInner, clampBinHeightToRow, clampRowSpanToInner, shellToCustomConfig } from "@/utils/rackBlueprintMapper";
import { canAddRowToSide, innerFromCustomConfig, nextRowYStart, reanchorSideRows } from "@/utils/rowStack";
import { getFixtureSeedLayout } from "@/utils/fixtureSeed";
import { boundsFromRacks, summarizeRacks } from "@/lib/planogram-formats/serialize";
import { importPlanogramContent } from "@/lib/planogram-formats";
import {
  applyCustomConfigWithCascade,
  binOccupiedFacingWidth,
  cascadeRescaleRack,
  productFacingWidth,
  type CascadeException,
} from "@/utils/layoutCascade";
import { maxFacingsInBinVolume } from "@/utils/facingPack";
import { buildPendingRackFromFixture } from "@/utils/fixturePlacement";
import { extractApiErrorMessage, toastApiError } from "@/utils/apiMessages";
import type { SceneTheme } from "@/constants/sceneTheme";
import {
  DEFAULT_BIN_DEPTH,
  DEFAULT_BIN_HEIGHT,
  DEFAULT_BIN_WIDTH,
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
  DEFAULT_RACK_DEPTH,
  DEFAULT_RACK_WIDTH,
  GROCERY_SHELF_SPACING,
} from "@/constants/dimensions";
import {
  DEFAULT_AREA_DEPTH,
  DEFAULT_AREA_WIDTH,
} from "@/constants/warehouse";
// import { parseJSONToPlanogram } from '@/utils/jsonParser' // Removed: Logic consolidated in store

export interface Product {
  id: string;
  name: string;
  color: string;
  width: number;
  height: number;
  depth: number;
  brandName?: string;
  categoryName?: string;
  imageUrl?: string;
  /** Direct GLB URL or path (e.g. /models/foo.glb) */
  modelUrl?: string;
  /** Object storage key for .glb — loaded via /api/files/model?key= */
  modelStorageKey?: string;
  quantity?: number;
}

export interface PendingProductParams {
  id: string;
  name: string;
  code?: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  size?: string | null;
  variant?: string | null;
  imageUrl?: string | null;
  modelUrl?: string | null;
  modelStorageKey?: string | null;
  width: number;
  height: number;
  depth: number;
  color?: string;
}

/** Live ghost facings while Attach Product modal quantity/dims change. */
export interface AttachFacingPreview {
  binId: string;
  width: number;
  height: number;
  depth: number;
  quantity: number;
  fits: boolean;
  modelUrl?: string | null;
  modelStorageKey?: string | null;
  color?: string;
}

/** Ghost bin on the selected row while Add Bin modal is open. */
export interface PendingBinPreview {
  rowId: string;
  width: number;
  depth: number;
  height: number;
}

export interface Bin {
  id: string;
  width: number;
  depth: number;
  height: number;
  products: Product[];
  binName?: string;
}

export type RowSided = "one" | "two";

export interface Row {
  id: string;
  height: number;
  /** Shelf span inside rack (m). API field: `span`. */
  width?: number;
  span?: number;
  dividerThickness?: number;
  sided?: RowSided;
  bins: Bin[];
  dividerPosmItemId?: string | null;
  dividerPosm?: RackSurfacePosm | null;
  yStart?: number | null;
  yEnd?: number | null;
}

export interface RackSide {
  id: string;
  sideId: string;
  sideCode: string;
  depth?: number | null;
  inner?: ZoneFootprint | null;
  outer?: ZoneFootprint | null;
  header?: ZoneVolume | null;
  footer?: ZoneVolume | null;
  /** API side cavity metrics when present. */
  dimensions?: {
    usableWidth?: number | null;
    usableDepth?: number | null;
    usableHeight?: number | null;
  } | null;
  rows: Row[];
}

export interface RackRotation {
  x: number;
  y: number;
  z: number;
}

export interface Rack {
  id: string;
  rackId: string;
  rackCode: string;
  width: number;
  depth: number;
  height?: string;
  fixtureType?: FixtureType;
  customConfig?: CustomRackConfig;
  blueprintName?: string | null;
  /** Server-set on successful publish (ISO UTC). Never send from client. */
  publishedAt?: string | null;
  /** Server audit UpdatedAt (ISO UTC). Read-only. */
  lastUpdated?: string | null;
  placement?: RackPlacement | null;
  outer?: Dimensions3 | null;
  shell?: RackShell | null;
  inner?: Dimensions3 | null;
  position: { x: number; y: number; z: number };
  rotation?: RackRotation;
  sides: RackSide[];
  quadrant?: Quadrant;
  isDoubleSided?: boolean;
}

export interface Area {
  width: number;
  depth: number;
  racks: Rack[];
}

export type RackSided = "one" | "two";
export type Quadrant = "NW" | "NE" | "SW" | "SE";

export interface PendingRackParams {
  width: number;
  depth: number;
  /** Outer height (m) — required for backend outer.height on create. */
  height?: number;
  plankType: string;
  sided?: RackSided;
  rackCode?: string;
  /** Display name — sent as blueprintName; defaults to rackCode. */
  rackName?: string;
  globalLocationId?: string;
  fixtureType?: FixtureType;
  customConfig?: CustomRackConfig;
}

// Utility function to determine quadrant from position
export function getQuadrantFromPosition(x: number, z: number): Quadrant {
  if (x < 0 && z >= 0) return "NW"; // North-West
  if (x >= 0 && z >= 0) return "NE"; // North-East
  if (x < 0 && z < 0) return "SW"; // South-West
  return "SE"; // South-East
}

export type ViewMode = "traditional" | "advanced";

export interface PlanogramState {
  area: Area;
  viewMode: ViewMode;
  sceneTheme: SceneTheme;
  setSceneTheme: (theme: SceneTheme) => void;
  roofVisible: boolean;
  setRoofVisible: (visible: boolean) => void;
  fixturePaletteCollapsed: boolean;
  productPaletteCollapsed: boolean;
  setFixturePaletteCollapsed: (collapsed: boolean) => void;
  setProductPaletteCollapsed: (collapsed: boolean) => void;
  selectedId: string | null;
  selectedType: "area" | "rack" | "row" | "bin" | "product" | null;
  isPlacingRack: boolean;
  pendingRackParams: PendingRackParams | null;
  placingFixtureType: FixtureType | null;
  isPlacingProduct: boolean;
  pendingProductParams: PendingProductParams | null;
  /** Bin under cursor during SKU drag-over (for highlight + slot preview). */
  productDropHover: { binId: string; fits: boolean; reason?: string } | null;
  setProductDropHover: (
    hover: { binId: string; fits: boolean; reason?: string } | null,
  ) => void;
  /** Live facing ghosts while Attach Product modal edits quantity / dims. */
  attachFacingPreview: AttachFacingPreview | null;
  setAttachFacingPreview: (preview: AttachFacingPreview | null) => void;
  /** Ghost bin on row while Add Bin modal edits dimensions. */
  pendingBinPreview: PendingBinPreview | null;
  setPendingBinPreview: (preview: PendingBinPreview | null) => void;
  startProductPlacement: (product: PendingProductParams) => void;
  cancelProductPlacement: () => void;
  placeProductOnBin: (
    binId: string,
    quantity?: number,
  ) => Promise<{ success: boolean; message?: string }>;
  customRackBuilderOpen: boolean;
  customRackDraft: CustomRackConfig;
  editingCustomRackId: string | null;
  openCustomRackBuilder: (preset?: "END_CAP" | "REFRIGERATED" | "CUSTOM", rackId?: string) => void;
  closeCustomRackBuilder: () => void;
  setCustomRackDraft: (patch: Partial<CustomRackConfig> | ((prev: CustomRackConfig) => CustomRackConfig)) => void;
  placeCustomRackFromBuilder: (rackName?: string) => void;
  /** Display name for the next rack placed (preset click / drag-drop). Sent as blueprintName. */
  nextRackName: string;
  setNextRackName: (name: string) => void;
  updateRackCustomConfig: (rackId: string, config: CustomRackConfig) => {
    exceptions?: CascadeException[];
  };
  /** Last cascade warnings from rescale (not dropped silently). */
  layoutCascadeExceptions: CascadeException[];
  clearLayoutCascadeExceptions: () => void;
  renderTime: number | null;
  importSummary: {
    totalRacks: number;
    totalAisles: number;
    totalRows: number;
    totalBins: number;
    totalProducts: number;
  } | null;
  isImporting: boolean;
  importProgress: number;
  addProductError: string | null;
  addRackError: string | null;
  isAddingRack: boolean;
  editingRackId: string | null;
  moveRackError: string | null;
  selectedStoreId: string | null;
  selectedStoreName: string | null;
  isLoadingStoreLayout: boolean;
  setIsLoadingStoreLayout: (value: boolean) => void;
  setSelectedStore: (id: string | null, name?: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setAddRackError: (value: string | null) => void;
  setEditingRackId: (id: string | null) => void;
  setMoveRackError: (value: string | null) => void;
  setSelected: (
    id: string | null,
    type: "area" | "rack" | "row" | "bin" | "product" | null,
  ) => void;
  setIsPlacingRack: (value: boolean) => void;
  setPendingRackParams: (params: PendingRackParams | null) => void;
  startFixturePlacement: (fixtureType: FixtureType) => void;
  cancelFixturePlacement: () => void;
  addRack: (
    position?: { x: number; y: number; z: number },
    dimensions?: {
      width: number;
      depth: number;
      plankType: string;
      sided?: RackSided;
      fixtureType?: FixtureType;
    },
  ) => void;
  addRackToServer: (
    position?: { x: number; y: number; z: number },
  dimensions?: {
    width: number;
    depth: number;
    height?: number;
    plankType: string;
    sided?: RackSided;
    rackCode?: string;
    rackName?: string;
    fixtureType?: FixtureType;
    customConfig?: CustomRackConfig;
    globalLocationId?: string;
  },
    globalLocationId?: string,
    options?: { snapToWall?: boolean; rotationY?: number },
  ) => Promise<{ success: boolean; message: string }>;
  addRow: (rackId: string, height?: number) => void;
  addRowToServer: (
    rackId: string,
    height?: number,
    note?: string,
    options?: { quiet?: boolean },
  ) => Promise<{ success: boolean; message: string }>;
  updateRowHeight: (
    rowId: string,
    height: number,
  ) => Promise<{ success: boolean; message?: string }>;
  updateRowDimensions: (
    rowId: string,
    dims: { height?: number; width?: number },
  ) => Promise<{ success: boolean; message?: string }>;
  addBinToServer: (
    rowId: string,
    rowExtent1?: number,
    rowExtent2?: number,
    rowHeight?: number,
    binName?: string,
    binDims?: { width?: number; depth?: number; height?: number },
    options?: { quiet?: boolean },
  ) => Promise<{ success: boolean; message: string; binId?: string }>;
  /** After placing GONDOLA / FREEZER / PEGBOARD — create rows+bins via backend. */
  seedPresetFixtureShelves: (
    rackId: string,
  ) => Promise<{ success: boolean; message?: string }>;
  addBin: (
    rowId: string,
    rowExtent1?: number,
    rowExtent2?: number,
    rowHeight?: number,
    binName?: string,
    binDims?: { width?: number; depth?: number; height?: number },
  ) => void;
  addProduct: (
    binId: string,
    product?: Partial<Product>,
  ) => { success: boolean; reason?: string };
  attachProductToBin: (
    binId: string,
    product: Partial<Product> & { id: string },
    quantity: number
  ) => Promise<{ success: boolean; message?: string }>;
  /** Re-fetch store layout from the API (preserves rack positions). */
  reloadStoreLayout: () => Promise<{ success: boolean; message?: string }>;
  /** Persist one rack's full nested layout (placement, shell, sides/rows/bins/products). */
  saveRackLayoutToServer: (
    rackId: string,
    options?: { suppressLoading?: boolean; reflowSkus?: boolean },
  ) => Promise<{ success: boolean; message?: string }>;
  /** Persist all server-backed racks in the current store layout. */
  saveStoreLayoutToServer: () => Promise<{
    success: boolean;
    message?: string;
    saved?: number;
    failed?: number;
  }>;
  isSavingLayout: boolean;
  saveLayoutError: string | null;
  canProductFitInBin: (
    binId: string,
    product: { width: number; depth: number; height: number; quantity?: number },
    /**
     * When `quantity` is the TOTAL (merged) count for an existing SKU, pass its
     * id here so its current facings aren't counted twice in used width.
     */
    excludeProductId?: string,
  ) => { fits: boolean; reason?: string };
  updateDimensions: (
    entityId: string,
    type: "area" | "rack" | "row" | "bin" | "product",
    values: Partial<any>,
  ) => void;
  updateRackPosition: (
    rackId: string,
    position: { x: number; y: number; z: number },
  ) => void;
  /** Set absolute Y rotation in radians (also syncs placement for save). */
  setRackRotationY: (rackId: string, rotationY: number) => void;
  /** Rotate rack around Y by delta degrees (default ±90). */
  rotateRack: (rackId: string, deltaDegrees?: number) => void;
  deleteRack: (rackId: string) => void;
  deleteRackFromServer: (rackId: string) => Promise<{ success: boolean; message: string }>;
  deleteRow: (rowId: string) => void;
  deleteBin: (binId: string) => void;
  deleteBinFromServer: (binId: string) => Promise<{ success: boolean; message: string }>;
  deleteBlueprintFromServer: (
    blueprintId: string,
  ) => Promise<{ success: boolean; message: string }>;
  deleteProduct: (productId: string) => void;
  clearBinProductsLocally: (binId: string) => void;
  detachBinInventory: (binId: string) => Promise<{ success: boolean; message?: string }>;
  deleteProductFromServer: (productId: string) => Promise<{ success: boolean; message?: string }>;
  assignRackPosmItems: (
    rackId: string,
    payload: import('@/types/rackBlueprint').UpdateRackPosmItemsRequest,
    posmCatalog?: Record<string, RackSurfacePosm>,
  ) => Promise<{ success: boolean; message?: string }>;
  assignRowDividerPosm: (
    rackId: string,
    rowId: string,
    posmItemId: string | null,
    hydrated?: RackSurfacePosm | null,
  ) => Promise<{ success: boolean; message?: string }>;
  loadFromJSON: (
    jsonData: any,
    onProgress?: (progress: number) => void,
  ) => Promise<void>;
  /** Apply racks imported from .psa / .plm into the live editor. */
  applyImportedPlanogram: (
    racks: Rack[],
    area?: { width: number; depth: number },
  ) => void;
  /** Parse and apply .psa / .plm planogram files (legacy JSON uses loadFromJSON). */
  importPlanogramFromContent: (
    content: string,
    filename?: string,
  ) => Promise<import('@/lib/planogram-formats').PlanogramImportResult>;
  lastImportReport: import('@/lib/planogram-formats').ImportReport | null;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractBinList(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items ?? payload.results ?? payload.bins ?? payload.data ?? [];
}

/** After create-bin, resolve the real server binId from the row listing. */
async function resolveBinIdFromRow(
  rowId: string,
  headers: Record<string, string>,
  binName?: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/bins/by-row/${encodeURIComponent(rowId)}`, { headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.isRequestSuccess === false) return undefined;
    const bins = extractBinList(json?.data ?? json);
    if (!bins.length) return undefined;

    if (binName) {
      const byName = bins.find(
        (b: any) => (b.binName ?? b.name ?? '').trim() === binName.trim(),
      );
      if (byName) return byName.binId ?? byName.id;
    }

    const sorted = [...bins].sort(
      (a: any, b: any) => Number(b.sequenceNumber ?? 0) - Number(a.sequenceNumber ?? 0),
    );
    const latest = sorted[0];
    return latest?.binId ?? latest?.id;
  } catch {
    return undefined;
  }
}

function extractCreatedBinId(data: any): string | undefined {
  if (!data) return undefined;
  if (typeof data === 'string' && UUID_RE.test(data)) return data;
  if (typeof data === 'object') {
    const id = data.binId ?? data.id;
    if (typeof id === 'string' && UUID_RE.test(id)) return id;
    const nested = data.bin ?? data.data;
    if (nested) return extractCreatedBinId(nested);
  }
  return undefined;
}

// Default product size — ~1 L milk when catalog dims missing (meters)
const createProduct = (overrides?: Partial<Product>): Product => ({
  id: generateId(),
  name: `Product ${Math.floor(Math.random() * 1000)}`,
  color: `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`,
  width: DEFAULT_PRODUCT_WIDTH,
  height: DEFAULT_PRODUCT_HEIGHT,
  depth: DEFAULT_PRODUCT_DEPTH,
  ...overrides,
});

const createBin = (
  overrides?: Partial<Pick<Bin, "width" | "depth" | "height">>,
): Bin => ({
  id: generateId(),
  width: DEFAULT_BIN_WIDTH,
  depth: DEFAULT_BIN_DEPTH,
  height: DEFAULT_BIN_HEIGHT,
  products: [],
  ...overrides,
});

const createRow = (height?: number, sided?: RowSided): Row => ({
  id: generateId(),
  height: height ?? GROCERY_SHELF_SPACING,
  sided: sided ?? "one",
  bins: [],
});

const createRack = (
  position?: { x: number; y: number; z: number },
  dimensions?: {
    width: number;
    depth: number;
    height?: number;
    plankType: string;
    sided?: RackSided;
    rackCode?: string;
    fixtureType?: FixtureType;
    customConfig?: CustomRackConfig;
  },
): Rack => {
  const fixtureType = dimensions?.fixtureType ?? "GONDOLA";
  const sided =
    dimensions?.sided ??
    (fixtureType === "GONDOLA" ? "two" : "one");
  const rackCode = dimensions?.rackCode ?? `RACK-${generateId().toUpperCase()}`;
  const sides: RackSide[] =
    sided === "two"
      ? [
        { id: generateId(), sideId: "Side1", sideCode: `${rackCode}-S1`, rows: [] },
        { id: generateId(), sideId: "Side2", sideCode: `${rackCode}-S2`, rows: [] },
      ]
      : [{ id: generateId(), sideId: "Side1", sideCode: `${rackCode}-S1`, rows: [] }];
  const rackPosition = position || { x: 0, y: 0, z: 0 };
  const width = dimensions?.width ?? DEFAULT_RACK_WIDTH;
  const depth = dimensions?.depth ?? DEFAULT_RACK_DEPTH;
  const outerH =
    dimensions?.height ??
    dimensions?.customConfig?.outerHeight ??
    FIXTURE_LIBRARY[fixtureType]?.defaultHeight ??
    2;
  return {
    id: generateId(),
    rackId: generateId(),
    rackCode,
    width,
    depth,
    height: String(outerH),
    fixtureType,
    customConfig: dimensions?.customConfig,
    outer: { width, depth, height: outerH },
    position: rackPosition,
    rotation: { x: 0, y: 0, z: 0 },
    sides,
    isDoubleSided: sided === "two",
    quadrant: getQuadrantFromPosition(rackPosition.x, rackPosition.z),
  };
};

export const usePlanogramStore = create<PlanogramState>((set, get) => ({
  area: {
    width: DEFAULT_AREA_WIDTH,
    depth: DEFAULT_AREA_DEPTH,
    racks: [],
  },
  viewMode: "advanced",
  sceneTheme: "day",
  setSceneTheme: (theme) => set({ sceneTheme: theme }),
  roofVisible: true,
  setRoofVisible: (visible) => set({ roofVisible: visible }),
  fixturePaletteCollapsed: false,
  productPaletteCollapsed: false,
  setFixturePaletteCollapsed: (collapsed) => set({ fixturePaletteCollapsed: collapsed }),
  setProductPaletteCollapsed: (collapsed) => set({ productPaletteCollapsed: collapsed }),
  selectedId: null,
  selectedType: null,
  isPlacingRack: false,
  pendingRackParams: null,
  placingFixtureType: null,
  isPlacingProduct: false,
  pendingProductParams: null,
  productDropHover: null,
  attachFacingPreview: null,
  pendingBinPreview: null,
  customRackBuilderOpen: false,
  customRackDraft: createBlankCustomRack(),
  editingCustomRackId: null,
  nextRackName: "",
  setNextRackName: (name) => set({ nextRackName: name }),
  renderTime: null,
  importSummary: null,
  isImporting: false,
  importProgress: 0,
  lastImportReport: null,
  addProductError: null,
  addRackError: null,
  layoutCascadeExceptions: [],
  clearLayoutCascadeExceptions: () => set({ layoutCascadeExceptions: [] }),
  isAddingRack: false,
  editingRackId: null,
  moveRackError: null,
  selectedStoreId: null,
  selectedStoreName: null,
  isLoadingStoreLayout: false,
  isSavingLayout: false,
  saveLayoutError: null,
  setIsLoadingStoreLayout: (value) => set({ isLoadingStoreLayout: value }),
  setSelectedStore: (id, name) => {
    if (typeof window !== "undefined") {
      try {
        if (id) {
          window.localStorage.setItem("planogram.selectedStoreId", id);
          window.localStorage.setItem("planogram.selectedStoreName", name ?? "");
        } else {
          window.localStorage.removeItem("planogram.selectedStoreId");
          window.localStorage.removeItem("planogram.selectedStoreName");
        }
      } catch {
        /* ignore */
      }
    }
    set((s) => ({
      selectedStoreId: id,
      selectedStoreName: name ?? null,
      isLoadingStoreLayout: Boolean(id),
      selectedId: null,
      selectedType: null,
      area: { ...s.area, racks: [] },
    }));
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelected: (id, type) => set({ selectedId: id, selectedType: type }),
  setIsPlacingRack: (value) => set({ isPlacingRack: value }),
  setPendingRackParams: (params) => set({ pendingRackParams: params }),
  startFixturePlacement: (fixtureType) => {
    const state = get();
    if (!state.selectedStoreId) {
      set({ addRackError: "Select a store before placing fixtures." });
      return;
    }
    set({
      pendingRackParams: buildPendingRackFromFixture(fixtureType, state),
      isPlacingRack: true,
      placingFixtureType: fixtureType,
      isPlacingProduct: false,
      pendingProductParams: null,
      selectedId: "area",
      selectedType: "area",
      addRackError: null,
      editingRackId: null,
    });
  },
  cancelFixturePlacement: () =>
    set({
      isPlacingRack: false,
      pendingRackParams: null,
      placingFixtureType: null,
    }),
  setProductDropHover: (hover) => set({ productDropHover: hover }),
  setAttachFacingPreview: (preview) => set({ attachFacingPreview: preview }),
  setPendingBinPreview: (preview) => set({ pendingBinPreview: preview }),
  startProductPlacement: (product) => {
    set({
      isPlacingProduct: true,
      pendingProductParams: product,
      isPlacingRack: false,
      pendingRackParams: null,
      placingFixtureType: null,
      addProductError: null,
      productDropHover: null,
      selectedId: null,
      selectedType: null,
    });
  },
  cancelProductPlacement: () =>
    set({
      isPlacingProduct: false,
      pendingProductParams: null,
      productDropHover: null,
    }),
  placeProductOnBin: async (binId, quantity = 1) => {
    const state = get();
    const pending = state.pendingProductParams;
    if (!pending) {
      return { success: false, message: 'No product selected for placement' };
    }

    const result = await get().attachProductToBin(
      binId,
      {
        id: pending.id,
        name: pending.name,
        width: pending.width,
        height: pending.height,
        depth: pending.depth,
        color: pending.color ?? '#2C5282',
        brandName: pending.brandName ?? undefined,
        categoryName: pending.categoryName ?? undefined,
        imageUrl: pending.imageUrl ?? undefined,
        modelUrl: pending.modelUrl ?? undefined,
        modelStorageKey: pending.modelStorageKey ?? undefined,
      },
      quantity,
    );

    if (result.success) {
      set({
        isPlacingProduct: false,
        pendingProductParams: null,
        productDropHover: null,
        selectedId: binId,
        selectedType: 'bin',
        addProductError: null,
      });
    } else {
      set({ addProductError: result.message ?? 'Failed to place product' });
    }
    return result;
  },
  openCustomRackBuilder: (preset = "CUSTOM", rackId) => {
    const state = get();
    let draft = createBlankCustomRack();
    if (preset === "END_CAP") draft = createEndCapPreset();
    if (preset === "REFRIGERATED") draft = createRefrigeratedPreset();
    if (rackId) {
      const rack = state.area.racks.find((r) => r.id === rackId);
      if (rack?.customConfig) draft = cloneCustomRackConfig(rack.customConfig);
      else if (rack?.shell && rack?.outer) {
        const fromShell = shellToCustomConfig(rack.shell, rack.outer, 'CUSTOM');
        if (fromShell) draft = fromShell;
      } else if (rack) {
        draft = {
          ...draft,
          outerWidth: rack.width,
          outerDepth: rack.depth,
        };
      }
    }
    draft = normalizeSectionSpans(draft);
    set({
      customRackBuilderOpen: true,
      customRackDraft: draft,
      editingCustomRackId: rackId ?? null,
      roofVisible: false,
    });
  },
  closeCustomRackBuilder: () =>
    set({
      customRackBuilderOpen: false,
      editingCustomRackId: null,
      customRackDraft: createBlankCustomRack(),
    }),
  setCustomRackDraft: (patch) =>
    set((s) => ({
      customRackDraft:
        typeof patch === "function"
          ? patch(s.customRackDraft)
          : { ...s.customRackDraft, ...patch },
    })),
  placeCustomRackFromBuilder: (rackName) => {
    const state = get();
    if (!state.selectedStoreId) {
      set({ addRackError: "Select a store before placing fixtures." });
      return;
    }
    const cfg = state.customRackDraft;
    const count =
      state.area.racks.filter((r) => r.fixtureType === "CUSTOM").length + 1;
    set({
      pendingRackParams: {
        width: cfg.outerWidth,
        depth: cfg.outerDepth,
        plankType: "custom",
        sided: "one",
        fixtureType: "CUSTOM",
        customConfig: cloneCustomRackConfig(cfg),
        rackCode: `CUSTOM-${String(count).padStart(2, "0")}`,
        rackName: rackName?.trim() || undefined,
        globalLocationId: state.selectedStoreId,
      },
      isPlacingRack: true,
      placingFixtureType: "CUSTOM",
      customRackBuilderOpen: false,
      selectedId: "area",
      selectedType: "area",
      addRackError: null,
      editingRackId: null,
    });
  },
  updateRackCustomConfig: (rackId, config) => {
    const state = get();
    const rack = state.area.racks.find((r) => r.id === rackId);
    if (!rack) return { exceptions: [] };
    const { rack: next, exceptions } = applyCustomConfigWithCascade(rack, config);
    set({
      layoutCascadeExceptions: exceptions,
      area: {
        ...state.area,
        racks: state.area.racks.map((r) => (r.id === rackId ? next : r)),
      },
    });
    return { exceptions };
  },
  setAddRackError: (value) => set({ addRackError: value }),
  setEditingRackId: (id) =>
    set({ editingRackId: id, ...(id ? { moveRackError: null } : {}) }),
  setMoveRackError: (value) => set({ moveRackError: value }),
  addRack: (position, dimensions) =>
    set((state) => {
      const dims = dimensions ?? state.pendingRackParams;
      const finalDims = dims
        ? {
          ...dims,
          sided:
            (dimensions?.sided as RackSided | undefined) ??
            state.pendingRackParams?.sided,
        }
        : state.pendingRackParams;
      const width = finalDims?.width ?? DEFAULT_RACK_WIDTH;
      const depth = finalDims?.depth ?? 20;
      const pos = position ?? { x: 0, y: 0, z: 0 };
      const halfW = state.area.width / 2;
      const halfD = state.area.depth / 2;

      if (width > state.area.width || depth > state.area.depth) {
        return {
          ...state,
          addRackError: `Rack size (${width} m × ${depth} m) exceeds warehouse floor (${state.area.width} m × ${state.area.depth} m).`,
        };
      }
      const minX = pos.x - width / 2;
      const maxX = pos.x + width / 2;
      const minZ = pos.z - depth / 2;
      const maxZ = pos.z + depth / 2;
      if (minX < -halfW || maxX > halfW || minZ < -halfD || maxZ > halfD) {
        return {
          ...state,
          addRackError: `Rack would extend outside the warehouse floor (${state.area.width} m × ${state.area.depth} m). Reduce size or place inside the floor.`,
        };
      }

      const rack = createRack(position, finalDims ?? undefined);
      return {
        area: {
          ...state.area,
          racks: [...state.area.racks, rack],
        },
        pendingRackParams: null,
        addRackError: null,
      };
    }),
  addRackToServer: async (position, dimensions, globalLocationId, options) => {
    const state = get();
    const dims = dimensions ?? state.pendingRackParams;
    const finalDims = dims
      ? {
        ...dims,
        sided:
          (dimensions?.sided as RackSided | undefined) ??
          state.pendingRackParams?.sided,
      }
      : state.pendingRackParams;

    const width = finalDims?.width ?? DEFAULT_RACK_WIDTH;
    const depth = finalDims?.depth ?? 20;
    const fixtureType = finalDims?.fixtureType ?? 'GONDOLA';
    const outerHeight =
      finalDims?.customConfig?.outerHeight ??
      finalDims?.height ??
      FIXTURE_LIBRARY[fixtureType]?.defaultHeight ??
      2;
    const pos = position ?? { x: 0, y: 0, z: 0 };

    let placeX = pos.x;
    let placeZ = pos.z;
    let rotationY = options?.rotationY ?? 0;

    if (options?.snapToWall !== false) {
      const snapped = snapRackToWall(
        { x: pos.x, z: pos.z },
        width,
        depth,
        state.area.width,
        state.area.depth,
      );
      placeX = snapped.x;
      placeZ = snapped.z;
      rotationY = options?.rotationY ?? snapped.rotationY;
    }

    const placedPos = { x: placeX, y: 0, z: placeZ };

    // Client-side validation
    if (width <= 0 || depth <= 0) {
      const msg = "Invalid dimensions: width and depth must be positive numbers.";
      set({ addRackError: msg });
      return { success: false, message: msg };
    }

    const halfW = state.area.width / 2;
    const halfD = state.area.depth / 2;

    if (width > state.area.width || depth > state.area.depth) {
      const msg = `Rack size (${width} m × ${depth} m) exceeds warehouse floor (${state.area.width} m × ${state.area.depth} m).`;
      set({ addRackError: msg });
      return { success: false, message: msg };
    }

    if (
      !isRackInsideFloor(
        placeX,
        placeZ,
        width,
        depth,
        rotationY,
        state.area.width,
        state.area.depth,
      )
    ) {
      const msg = `Rack would extend outside the warehouse floor (${state.area.width} m × ${state.area.depth} m).`;
      set({ addRackError: msg });
      return { success: false, message: msg };
    }

    const { halfW: footHalfW, halfD: footHalfD } = getRotatedFootprintHalf(
      width,
      depth,
      rotationY,
    );
    const minX = placeX - footHalfW;
    const maxX = placeX + footHalfW;
    const minZ = placeZ - footHalfD;
    const maxZ = placeZ + footHalfD;

    if (minX < -halfW || maxX > halfW || minZ < -halfD || maxZ > halfD) {
      const msg = `Rack would extend outside the warehouse floor (${state.area.width} m × ${state.area.depth} m).`;
      set({ addRackError: msg });
      return { success: false, message: msg };
    }

    set({ isAddingRack: true, addRackError: null });

    try {
      const quadrant = getQuadrantFromPosition(placeX, placeZ);
      const placement = {
        position: placedPos,
        rotation: { x: 0, y: rotationY, z: 0 },
        snapMode: 'wall' as const,
        quadrant,
      };

      const rackDisplayName =
        finalDims?.rackName?.trim() || state.nextRackName?.trim() || undefined;
      const payload = buildCreateRackPayload({
        storeId: globalLocationId || finalDims?.globalLocationId || state.selectedStoreId || '',
        rackCode: finalDims?.rackCode || `RACK-${Date.now()}`,
        blueprintName: rackDisplayName || finalDims?.rackCode,
        fixtureType,
        isDoubleSided: (finalDims?.sided || 'one') === 'two',
        width,
        depth,
        outerHeight,
        customConfig: finalDims?.customConfig,
        placement,
      });

      // Build headers and attach Authorization if token was provided to this iframe (read from cookies)
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
        const t = getPlanogramTokenFromCookie();
        if (t) headers["Authorization"] = `Bearer ${t}`;
      } catch (e) {
        // ignore cookie access errors
      }

      const res = await fetch("/api/racks/add-by-location", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.isRequestSuccess) {
        // Success: also add to local state. Backend now returns canonical ids
        // (e.g. { rackId, sideIds: [...] }). Map those into our created rack.
        const rack = createRack(placedPos, finalDims ?? undefined);
        rack.isDoubleSided = (finalDims?.sided || "one") === "two";
        rack.rotation = { x: 0, y: rotationY, z: 0 };
        rack.quadrant = quadrant;
        if (finalDims?.fixtureType) rack.fixtureType = finalDims.fixtureType;
        if (finalDims?.customConfig) rack.customConfig = cloneCustomRackConfig(finalDims.customConfig);
        rack.placement = placement;
        if (rackDisplayName || finalDims?.rackCode) {
          rack.blueprintName = rackDisplayName || finalDims?.rackCode;
        }
        if (finalDims?.customConfig) {
          rack.outer = {
            width: finalDims.customConfig.outerWidth,
            depth: finalDims.customConfig.outerDepth,
            height: finalDims.customConfig.outerHeight,
          };
          const inner = innerFromCustomConfig(rack);
          if (inner) rack.inner = inner;
        } else if (fixtureType !== 'CUSTOM') {
          rack.outer = { width, depth, height: outerHeight };
          const wallT = 0.08;
          rack.inner = {
            width: Math.max(0.1, width - wallT * 2),
            depth: Math.max(0.1, depth - wallT * 2),
            height: Math.max(0.1, outerHeight - 0.1),
          };
        }
        try {
          const returned = data.data ?? {};
          if (returned.rackId) {
            rack.rackId = returned.rackId;
            rack.id = returned.rackId;
          }
          if (Array.isArray(returned.sideIds) && returned.sideIds.length > 0) {
            rack.sides = rack.sides.map((side, idx) => ({
              ...side,
              sideId: returned.sideIds[idx] ?? side.sideId,
              id: returned.sideIds[idx] ?? side.sideId,
            }));
          } else if (Array.isArray(returned.sides) && returned.sides.length > 0) {
            rack.sides = rack.sides.map((side, idx) => {
              const apiSide = returned.sides[idx];
              const sideId = apiSide?.sideId ?? apiSide?.id ?? side.sideId;
              return { ...side, sideId, id: sideId };
            });
          }
          if (returned.shell && returned.outer && rack.fixtureType === 'CUSTOM') {
            const fromApi = shellToCustomConfig(
              returned.shell as RackShell,
              returned.outer as Dimensions3,
              'CUSTOM',
            );
            if (fromApi) rack.customConfig = fromApi;
            rack.shell = returned.shell as RackShell;
            rack.outer = returned.outer as Dimensions3;
          }
          if (returned.outer && rack.fixtureType !== 'CUSTOM') {
            rack.outer = returned.outer as Dimensions3;
          }
          if (returned.inner && rack.fixtureType !== 'CUSTOM') {
            rack.inner = returned.inner as Dimensions3;
          }
        } catch (e) {
          // non-fatal: if response shape differs, fall back to local ids
          console.warn('[planogram] Unexpected add-rack response shape', e, data);
        }

        set((s) => ({
          area: {
            ...s.area,
            racks: [...s.area.racks, rack],
          },
          pendingRackParams: null,
          isPlacingRack: false,
          placingFixtureType: null,
          isAddingRack: false,
          addRackError: null,
          nextRackName: "",
          selectedId: rack.id,
          selectedType: 'rack' as const,
        }));

        // Preset fixtures: create functional rows + bins on the backend
        if (fixtureType !== 'CUSTOM' && getFixtureSeedLayout(fixtureType)) {
          const seed = await get().seedPresetFixtureShelves(rack.id);
          if (!seed.success) {
            return {
              success: true,
              message:
                (data.message || 'Rack added') +
                ` — shelves not fully created: ${seed.message ?? 'unknown error'}`,
            };
          }
          return {
            success: true,
            message: data.message || 'Rack added with shelves and bins',
          };
        }

        return { success: true, message: data.message || "Rack added successfully" };
      } else {
        set({ isAddingRack: false, addRackError: data.message || "Failed to add rack" });
        return { success: false, message: data.message || "Failed to add rack" };
      }
    } catch (err) {
      const msg = "Error connecting to server. Please try again later.";
      set({ isAddingRack: false, addRackError: msg });
      return { success: false, message: msg };
    }
  },
  addRow: (rackId, height) =>
    set((state) => {
      const rack = state.area.racks.find((r) => r.id === rackId);
      if (!rack || rack.sides.length === 0) return state;

      // Row sidedness follows the rack: two-sided rack → row on both sides with sided 'two'
      const rowSided: RowSided = rack.sides.length === 2 ? "two" : "one";

      return {
        area: {
          ...state.area,
          racks: state.area.racks.map((r) =>
            r.id === rackId
              ? {
                ...r,
                sides: r.sides.map((side, idx) =>
                  rack.sides.length === 2
                    ? {
                      ...side,
                      rows: [...side.rows, createRow(height, rowSided)],
                    }
                    : idx === 0
                      ? {
                        ...side,
                        rows: [...side.rows, createRow(height, rowSided)],
                      }
                      : side,
                ),
              }
              : r,
          ),
        },
      };
    }),
  addRowToServer: async (rackId, height = 1.5, note, options) => {
    const quiet = options?.quiet === true;
    const state = get();
    const rack = state.area.racks.find((r) => r.id === rackId);
    if (!rack) return { success: false, message: 'Rack not found' };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } catch (e) {
      // ignore cookie access errors
    }

    const sideResults: {
      success: boolean;
      message: string;
      returnedId?: string;
      sideIndex: number;
      rowWidth?: number;
    }[] = [];

    for (let i = 0; i < rack.sides.length; i++) {
      const side = rack.sides[i];
      const rackSideId = side.sideId;
      if (!rackSideId) {
        sideResults.push({ success: false, message: 'Missing rack side id', sideIndex: i });
        continue;
      }

      try {
        const check = canAddRowToSide(rack, side, height);
        if (!check.ok) {
          sideResults.push({ success: false, message: check.message ?? 'Row does not fit', sideIndex: i });
          continue;
        }

        // API validates span against inner.width (outer − walls), not outer/rack.width
        const rowWidth = clampRowSpanToInner(rack);
        const yStart = nextRowYStart(side);
        const yEnd = yStart + height;
        const res = await fetch('/api/racks/add-row-by-side', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            rackSideId,
            note: note ?? undefined,
            height,
            span: rowWidth,
            width: rowWidth,
            sided: rack.sides.length === 2 ? 'two' : 'one',
            yStart,
            yEnd,
          }),
        });
        const data = await res.json();
        if (data?.isRequestSuccess) {
          const returnedId = resolveEntityId(data.data);
          sideResults.push({
            success: true,
            message: data.message || 'OK',
            returnedId,
            sideIndex: i,
            rowWidth,
          });
        } else {
          const message = extractApiErrorMessage(data, 'Failed to add row');
          sideResults.push({ success: false, message, sideIndex: i });
        }
      } catch (err) {
        sideResults.push({ success: false, message: 'Network error', sideIndex: i });
      }
    }

    const failedMessages = [
      ...new Set(sideResults.filter((s) => !s.success).map((s) => s.message)),
    ];
    if (failedMessages.length > 0 && !quiet) {
      toastApiError(failedMessages.join('; '));
    }

    // Apply successful results to local state
    const appliedCount = sideResults.filter((s) => s.success).length;
    if (appliedCount === 0) {
      const message = sideResults.map((s) => s.message).join('; ');
      return { success: false, message };
    }

    set((s) => {
      const racks = s.area.racks.map((r) => {
        if (r.id !== rackId) return r;
        const newSides = r.sides.map((side, idx) => {
          const result = sideResults.find((sr) => sr.sideIndex === idx && sr.success);
          if (!result) return side;
          const newRow = createRow(height, r.sides.length === 2 ? 'two' : 'one');
          if (result.returnedId) newRow.id = result.returnedId;
          if (result.rowWidth != null) newRow.width = result.rowWidth;
          const yStart = nextRowYStart(side);
          newRow.yStart = yStart;
          newRow.yEnd = yStart + height;
          return { ...side, rows: reanchorSideRows([...side.rows, newRow]) };
        });
        return { ...r, sides: newSides };
      });
      return { ...s, area: { ...s.area, racks } };
    });

    return { success: true, message: `Added ${appliedCount} row(s)` };
  },
  updateRowHeight: async (rowId, height) => get().updateRowDimensions(rowId, { height }),
  updateRowDimensions: async (rowId, dims) => {
    const h = dims.height != null ? Math.max(0.1, dims.height) : undefined;
    let w = dims.width != null ? Math.max(0.1, dims.width) : undefined;
    const rackRowId = resolveEntityId(rowId);

    // Clamp width to rack inner cavity so API validation passes
    if (w != null) {
      const state = get();
      outer: for (const rack of state.area.racks) {
        for (const side of rack.sides) {
          if (side.rows.some((row) => row.id === rowId)) {
            w = clampRowSpanToInner(rack, w);
            break outer;
          }
        }
      }
    }

    set((state) => ({
      area: {
        ...state.area,
        racks: state.area.racks.map((rack) => ({
          ...rack,
          sides: rack.sides.map((side) => {
            const hasRow = side.rows.some((row) => row.id === rowId)
            if (!hasRow) return side
            const rows = side.rows.map((row) => {
              if (row.id !== rowId) return row
              const nextH = h ?? row.height
              const maxBinH = Math.max(0.05, nextH - 0.15)
              return {
                ...row,
                ...(h != null ? { height: nextH } : {}),
                ...(w != null ? { width: w } : {}),
                bins: row.bins.map((bin) => ({
                  ...bin,
                  height: Math.min(bin.height, maxBinH),
                })),
              }
            })
            return { ...side, rows: h != null ? reanchorSideRows(rows) : rows }
          }),
        })),
      },
    }));

    if (!rackRowId || !UUID_RE.test(rackRowId)) {
      return { success: true };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } catch {
      /* ignore */
    }

    const payload: Record<string, number> = {};
    if (h != null) payload.height = h;
    if (w != null) {
      payload.width = w;
      payload.span = w;
    }

    try {
      const res = await fetch(`/api/rack-rows/${encodeURIComponent(rackRowId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.isRequestSuccess === false) {
        return { success: false, message: data.message || 'Failed to save row dimensions' };
      }
      return { success: true };
    } catch {
      return { success: true };
    }
  },
  addBinToServer: async (
    rowId: string,
    rowExtent1?: number,
    rowExtent2?: number,
    rowHeight?: number,
    binName?: string,
    binDims?: { width?: number; depth?: number; height?: number },
    options?: { quiet?: boolean },
  ) => {
    const quiet = options?.quiet === true;
    void quiet;
    const rackRowId = resolveEntityId(rowId);
    if (!rackRowId) {
      return { success: false, message: 'Invalid row id' };
    }

    const state = get();
    // find the row (+ parent rack for depth fallback)
    let foundRow: Row | null = null;
    let foundRack: Rack | null = null;
    for (const rack of state.area.racks) {
      for (const side of rack.sides) {
        for (const row of side.rows) {
          if (resolveEntityId(row.id) === rackRowId) {
            foundRow = row;
            foundRack = rack;
            break;
          }
        }
        if (foundRow) break;
      }
      if (foundRow) break;
    }
    if (!foundRow || !foundRack) return { success: false, message: 'Row not found' };

    const existingCount = foundRow.bins.length;
    const rowSpan = foundRow.width ?? clampRowSpanToInner(foundRack);
    // Backend requires width/height/depth > 0 and depth ≤ inner.depth
    const n = existingCount + 1;
    let binWidth =
      binDims?.width && binDims.width > 0
        ? binDims.width
        : rowExtent1 != null && rowExtent1 > 0
          ? rowExtent1 / n
          : Math.max(0.1, rowSpan / n);
    let binDepth = clampBinDepthToInner(
      foundRack,
      binDims?.depth && binDims.depth > 0
        ? binDims.depth
        : rowExtent2 != null && rowExtent2 > 0
          ? rowExtent2
          : null,
    );
    let binHeight = clampBinHeightToRow(
      rowHeight ?? foundRow.height,
      binDims?.height && binDims.height > 0 ? binDims.height : null,
    );

    // Clamp so sum of bin widths cannot exceed row span
    const usedWidth = foundRow.bins.reduce((sum, b) => sum + (b.width || 0), 0);
    const remaining = Math.max(0.1, rowSpan - usedWidth - 0.001);
    binWidth = Math.min(binWidth, remaining);
    // Round to 3 decimals to avoid float payloads like 0.9900000000000001
    binWidth = Math.round(binWidth * 1000) / 1000;
    binDepth = Math.round(binDepth * 1000) / 1000;
    binHeight = Math.round(binHeight * 1000) / 1000;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } catch (e) {
      // ignore
    }

    try {
      // Products stay empty — attach SKUs later via bin-inventory/attach
      const payload: Record<string, unknown> = {
        rackRowId,
        binName: binName?.trim() || null,
        aisle: null,
        width: binWidth,
        height: binHeight,
        depth: binDepth,
        slotIndex: existingCount,
        slotCount: n,
        products: [],
      };

      const res = await fetch('/api/bins/add-by-row', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data?.isRequestSuccess) {
        const detail =
          Array.isArray(data?.errors) && data.errors.length
            ? data.errors.map((e: any) => e.message || e.field).join('; ')
            : null;
        return {
          success: false,
          message: detail || data?.message || 'Failed to add bin',
        };
      }

      let returnedId = extractCreatedBinId(data?.data ?? data);
      if (!returnedId) {
        returnedId = await resolveBinIdFromRow(rackRowId, headers, binName);
      }

      if (!returnedId) {
        return {
          success: false,
          message: 'Bin was created but no server id was returned — refresh the store layout and try again',
        };
      }

      // Create and insert local bin
      set((s) => {
        const racks = s.area.racks.map((rack) => ({
          ...rack,
          sides: rack.sides.map((side) => ({
            ...side,
            rows: side.rows.map((row) => {
              if (resolveEntityId(row.id) !== rackRowId) return row;
              const newBin = createBin({
                width: binWidth,
                depth: binDepth,
                height: binHeight,
              });
              newBin.id = returnedId;
              if (binName) newBin.binName = binName;
              return { ...row, bins: [...row.bins, newBin] };
            }),
          })),
        }));
        return { ...s, area: { ...s.area, racks } };
      });

      return { success: true, message: data?.message || 'Bin added', binId: returnedId };
    } catch (err) {
      return { success: false, message: 'Network or server error' };
    }
  },
  seedPresetFixtureShelves: async (rackId) => {
    const rack = get().area.racks.find((r) => r.id === rackId || r.rackId === rackId);
    if (!rack) return { success: false, message: 'Rack not found' };
    const fixtureType = rack.fixtureType ?? 'GONDOLA';
    const layout = getFixtureSeedLayout(fixtureType);
    if (!layout) return { success: true, message: 'No seed layout for this fixture' };

    let rowsOk = 0;
    let binsOk = 0;
    const errors: string[] = [];

    for (let rowIdx = 0; rowIdx < layout.rows.length; rowIdx++) {
      const spec = layout.rows[rowIdx];
      const beforeCounts = get()
        .area.racks.find((r) => r.id === rackId || r.rackId === rackId)
        ?.sides.map((s) => s.rows.length) ?? [];

      const rowRes = await get().addRowToServer(rackId, spec.height, undefined, { quiet: true });
      if (!rowRes.success) {
        errors.push(`Row ${rowIdx + 1}: ${rowRes.message}`);
        break;
      }
      rowsOk += 1;

      const fresh = get().area.racks.find((r) => r.id === rackId || r.rackId === rackId);
      if (!fresh) {
        errors.push('Rack disappeared while seeding');
        break;
      }

      const newRows: Row[] = [];
      fresh.sides.forEach((side, sideIdx) => {
        const prev = beforeCounts[sideIdx] ?? 0;
        if (side.rows.length > prev) {
          newRows.push(...side.rows.slice(prev));
        }
      });

      for (const row of newRows) {
        const rowSpan = row.width ?? clampRowSpanToInner(fresh);
        const binW = Math.max(0.1, (rowSpan - 0.001) / spec.bins);
        const binD = clampBinDepthToInner(fresh);
        const binH = clampBinHeightToRow(spec.height);
        for (let b = 0; b < spec.bins; b++) {
          const label = `${spec.binLabel ?? 'Bin'} ${rowIdx + 1}-${b + 1}`;
          const binRes = await get().addBinToServer(
            row.id,
            undefined,
            undefined,
            spec.height,
            label,
            { width: binW, depth: binD, height: binH },
            { quiet: true },
          );
          if (binRes.success) binsOk += 1;
          else errors.push(`${label}: ${binRes.message}`);
        }
      }
    }

    if (rowsOk === 0) {
      return {
        success: false,
        message: errors[0] ?? 'Could not create shelves',
      };
    }

    return {
      success: errors.length === 0,
      message:
        errors.length === 0
          ? `Created ${rowsOk} shelf level(s) and ${binsOk} bin(s)`
          : `Partial: ${rowsOk} rows, ${binsOk} bins. ${errors[0]}`,
    };
  },
  addBin: (
    rowId: string,
    rowExtent1?: number,
    rowExtent2?: number,
    rowHeight?: number,
    binName?: string,
    binDims?: { width?: number; depth?: number; height?: number },
  ) =>
    set((state) => {
      const useRowDimensions = rowExtent1 != null && rowExtent2 != null;
      const binHeightUse = binDims?.height ?? rowHeight ?? DEFAULT_BIN_HEIGHT;

      return {
        area: {
          ...state.area,
          racks: state.area.racks.map((rack) => ({
            ...rack,
            sides: rack.sides.map((side) => ({
              ...side,
              rows: side.rows.map((row) => {
                if (row.id !== rowId) return row;
                const n = row.bins.length + 1;

                // Calculate new bin dimensions
                let binWidth: number;
                let binDepth: number;

                if (
                  useRowDimensions &&
                  rowExtent1 != null &&
                  rowExtent2 != null
                ) {
                  if (n === 1) {
                    // First bin: use full dimensions
                    binWidth = rowExtent1; // Full width
                    binDepth = rowExtent2; // Full depth
                  } else {
                    // For subsequent bins, determine which dimension is longer
                    // Compare the actual usable dimensions (rowExtent1 = width*0.85, rowExtent2 = depth*0.9)
                    // To compare fairly, normalize by their scaling factors
                    const normalizedWidth = rowExtent1 / 0.85; // Original width
                    const normalizedDepth = rowExtent2 / 0.9; // Original depth

                    if (normalizedWidth >= normalizedDepth) {
                      // Width is longer (or equal), split width, keep full depth
                      binWidth = rowExtent1 / n;
                      binDepth = rowExtent2; // Keep full depth
                    } else {
                      // Depth is longer, split depth, keep full width
                      binWidth = rowExtent1; // Keep full width
                      binDepth = rowExtent2 / n;
                    }
                  }
                } else {
                  binWidth = DEFAULT_BIN_WIDTH;
                  binDepth = DEFAULT_BIN_DEPTH;
                }

                if (binDims?.width && binDims.width > 0) binWidth = binDims.width;
                if (binDims?.depth && binDims.depth > 0) binDepth = binDims.depth;
                const binHeight = binHeightUse;
                const newBin = createBin({
                  width: binWidth,
                  depth: binDepth,
                  height: binHeight,
                });

                // Update all existing bins to the new split dimensions
                const updatedBins = row.bins.map((b) => ({
                  ...b,
                  width: binWidth,
                  depth: binDepth,
                  height: binHeight,
                }));

                return { ...row, bins: [...updatedBins, newBin] };
              }),
            })),
          })),
        },
      };
    }),
  canProductFitInBin: (binId, product, excludeProductId) => {
    const state = get();
    let bin: Bin | null = null;
    for (const rack of state.area.racks) {
      for (const side of rack.sides) {
        for (const row of side.rows) {
          const b = row.bins.find((x) => x.id === binId);
          if (b) {
            bin = b;
            break;
          }
        }
        if (bin) break;
      }
      if (bin) break;
    }
    if (!bin) return { fits: false, reason: "Bin not found" };
    const qty = Math.max(1, Math.floor(Number(product.quantity) || 1));
    // Treat suspiciously short bin.height as shelf thickness — use a usable cavity for fit.
    const fitHeight =
      bin.height > 0 && bin.height < 0.12 ? Math.max(bin.height, 0.35) : bin.height;
    if (
      product.width > bin.width ||
      product.depth > bin.depth ||
      product.height > fitHeight
    ) {
      return {
        fits: false,
        reason: `Product (${(product.width * 100).toFixed(0)}×${(product.depth * 100).toFixed(0)}×${(product.height * 100).toFixed(0)} cm) exceeds bin (${(bin.width * 100).toFixed(0)}×${(bin.depth * 100).toFixed(0)}×${(fitHeight * 100).toFixed(0)} cm)`,
      };
    }
    // Pack left→right then front→back (width × depth footprint).
    // When `quantity` is the merged total for an existing SKU, drop that SKU's
    // current facings so they aren't counted twice.
    const otherProducts = excludeProductId
      ? bin.products.filter((p) => resolveEntityId(p.id) !== resolveEntityId(excludeProductId) && p.id !== excludeProductId)
      : bin.products;
    const usedFacings = otherProducts.reduce(
      (sum, p) => sum + Math.max(1, Math.floor(Number(p.quantity) || 1)),
      0,
    );
    const maxTotal = maxFacingsInBinVolume(
      bin.width,
      bin.depth,
      fitHeight,
      product.width,
      product.depth,
      product.height,
    );
    const cols = Math.max(0, Math.floor(bin.width / product.width + 1e-6));
    const depthRows = Math.max(0, Math.floor(bin.depth / product.depth + 1e-6));
    const stackLayers = Math.max(0, Math.floor(fitHeight / product.height + 1e-6));
    const maxNew = Math.max(0, maxTotal - usedFacings);
    if (qty > maxNew) {
      const mergedHint = Boolean(excludeProductId);
      const gridLabel = `${cols} across × ${depthRows} deep × ${stackLayers} stacked`;
      return {
        fits: false,
        reason:
          maxNew > 0
            ? mergedHint
              ? `${qty} facing${qty === 1 ? "" : "s"} exceed bin capacity (${(product.width * 100).toFixed(0)}×${(product.depth * 100).toFixed(0)}×${(product.height * 100).toFixed(0)} cm · ${gridLabel} = ${maxTotal} max).`
              : `${qty} facing${qty === 1 ? "" : "s"} exceed remaining capacity (${gridLabel}). Only ${maxNew} more can fit.`
            : `Product facing (${(product.width * 100).toFixed(0)}×${(product.depth * 100).toFixed(0)}×${(product.height * 100).toFixed(0)} cm) does not fit remaining shelf space.`,
      };
    }
    return { fits: true };
  },
  addProduct: (binId, productOverrides) => {
    const state = get();
    const product = createProduct(productOverrides);
    let existingQty = 0;
    for (const rack of state.area.racks) {
      for (const side of rack.sides) {
        for (const row of side.rows) {
          const bin = row.bins.find((b) => b.id === binId);
          if (bin) {
            const existing = bin.products.find((p) => p.id === product.id);
            if (existing) existingQty = existing.quantity ?? 1;
            break;
          }
        }
      }
    }
    const mergedQty = existingQty > 0 ? existingQty + (product.quantity ?? 1) : (product.quantity ?? 1);
    const check = get().canProductFitInBin(
      binId,
      {
        width: product.width,
        depth: product.depth,
        height: product.height,
        quantity: mergedQty,
      },
      // Merged qty already includes existing facings — don't double-count them.
      product.id,
    );
    if (!check.fits) {
      set({ addProductError: check.reason ?? "Product does not fit" });
      return { success: false, reason: check.reason };
    }
    set((s) => ({
      addProductError: null,
      area: {
        ...s.area,
        racks: s.area.racks.map((rack) => ({
          ...rack,
          sides: rack.sides.map((side) => ({
            ...side,
            rows: side.rows.map((row) => ({
              ...row,
              bins: row.bins.map((bin) => {
                if (bin.id !== binId) return bin;
                const existingIdx = bin.products.findIndex((p) => p.id === product.id);
                if (existingIdx >= 0) {
                  return {
                    ...bin,
                    products: bin.products.map((p, i) =>
                      i === existingIdx ? { ...p, quantity: mergedQty } : p,
                    ),
                  };
                }
                return { ...bin, products: [...bin.products, product] };
              }),
            })),
          })),
        })),
      },
    }));
    return { success: true };
  },
  attachProductToBin: async (binId, product, quantity) => {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const serverBinId = resolveEntityId(binId);
    const skuId = resolveEntityId(product.id);
    const canAttachInventory =
      Boolean(serverBinId && skuId && UUID_RE.test(serverBinId) && UUID_RE.test(skuId));

    // Resolve local bin dims (always required by attach business rule)
    let localBin: Bin | undefined;
    for (const rack of get().area.racks) {
      for (const side of rack.sides) {
        for (const row of side.rows) {
          const b = row.bins.find((x) => x.id === binId || resolveEntityId(x.id) === serverBinId);
          if (b) {
            localBin = b;
            break;
          }
        }
        if (localBin) break;
      }
      if (localBin) break;
    }

    const skuW = Number(product.width);
    const skuH = Number(product.height);
    const skuD = Number(product.depth);
    const binW = Number(localBin?.width);
    const binH = Number(localBin?.height);
    const binD = Number(localBin?.depth);

    const skuDimsOk = [skuW, skuH, skuD].every((n) => Number.isFinite(n) && n > 0);
    const binDimsOk = [binW, binH, binD].every((n) => Number.isFinite(n) && n > 0);

    if (skuDimsOk) {
      const fit = get().canProductFitInBin(binId, {
        width: skuW,
        depth: skuD,
        height: skuH,
        quantity: qty,
      });
      if (!fit.fits) {
        return { success: false, message: fit.reason };
      }
    }

    if (canAttachInventory && serverBinId && skuId) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
        const t = getPlanogramTokenFromCookie();
        if (t) headers['Authorization'] = `Bearer ${t}`;
      } catch {
        /* ignore */
      }

      // Bins and SKUs should already have dims from create flows; attach directly.
      try {
        if (!binDimsOk) {
          return {
            success: false,
            message: 'Bin dimensions must be set before attaching a SKU. Edit the bin size and retry.',
          };
        }
        if (!skuDimsOk) {
          return {
            success: false,
            message:
              'This catalog SKU has no dimensions. Set width/depth/height on the SKU (or create with dims) before attaching.',
          };
        }

        const res = await fetch('/api/bins/attach-product', {
          method: 'POST',
          headers,
          body: JSON.stringify({ binId: serverBinId, skuId, quantity: qty }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.isRequestSuccess === false) {
          const attachMsg = extractApiErrorMessage(data, 'Failed to attach product to bin inventory');
          return { success: false, message: attachMsg };
        }
      } catch {
        return { success: false, message: 'Network error while attaching product' };
      }
    }

    const local = get().addProduct(binId, {
      ...product,
      id: skuId || product.id,
      width: skuDimsOk ? skuW : product.width,
      height: skuDimsOk ? skuH : product.height,
      depth: skuDimsOk ? skuD : product.depth,
      quantity: qty,
      imageUrl: product.imageUrl,
      modelUrl: product.modelUrl,
      modelStorageKey: product.modelStorageKey,
      brandName: product.brandName,
      categoryName: product.categoryName,
    });
    if (!local.success) {
      return { success: false, message: local.reason ?? 'Failed to attach product locally' };
    }

    // Refresh from server so bin/product placement matches canonical layout
    // (avoids products sitting too low until a manual reload).
    if (canAttachInventory) {
      try {
        await get().reloadStoreLayout();
      } catch {
        /* non-fatal — local add already succeeded */
      }
    }

    return {
      success: true,
      message: canAttachInventory
        ? 'Product attached to inventory'
        : 'Product added locally (bin or SKU has no server id yet)',
    };
  },
  reloadStoreLayout: async () => {
    const { selectedStoreId, area } = get();
    if (!selectedStoreId) {
      return { success: false, message: 'No store selected' };
    }

    try {
      const { fetchStoreLayoutRacks, mergeRackPositions, gridPlaceRacks } = await import(
        '@/utils/storeLayoutLoader'
      );
      const result = await fetchStoreLayoutRacks(selectedStoreId);
      if (!result.success) {
        return { success: false, message: result.message };
      }

      const fresh = result.racks;
      const placed =
        area.racks.length > 0
          ? mergeRackPositions(area.racks, fresh)
          : gridPlaceRacks(fresh, area.width, area.depth);

      set({ area: { ...area, racks: placed } });
      return { success: true };
    } catch {
      return { success: false, message: 'Failed to reload store layout' };
    }
  },
  saveRackLayoutToServer: async (rackId, options) => {
    const state = get();
    const rack = state.area.racks.find((r) => r.id === rackId || r.rackId === rackId);
    if (!rack) {
      return { success: false, message: 'Rack not found' };
    }

    const serverRackId = rack.rackId || rack.id;
    if (!UUID_RE.test(serverRackId)) {
      return {
        success: false,
        message: 'Rack has no server id yet — place it on the floor first so it is created on the backend.',
      };
    }

    if (!options?.suppressLoading) {
      set({ isSavingLayout: true, saveLayoutError: null });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } catch {
      /* ignore */
    }

    try {
      const payload = buildUpdateRackPayload(rack, { reflowSkus: options?.reflowSkus });
      const res = await fetch(`/api/racks/${encodeURIComponent(serverRackId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.isRequestSuccess === false) {
        const message = data?.message || `Failed to save layout (${res.status})`;
        if (!options?.suppressLoading) {
          set({ isSavingLayout: false, saveLayoutError: message });
        }
        return { success: false, message };
      }

      if (!options?.suppressLoading) {
        set({ isSavingLayout: false, saveLayoutError: null });
      }
      return { success: true, message: data?.message || 'Layout saved' };
    } catch {
      const message = 'Network error while saving layout';
      if (!options?.suppressLoading) {
        set({ isSavingLayout: false, saveLayoutError: message });
      }
      return { success: false, message };
    }
  },
  saveStoreLayoutToServer: async () => {
    const state = get();
    if (!state.selectedStoreId) {
      return { success: false, message: 'No store selected' };
    }

    const serverRacks = state.area.racks.filter((r) => UUID_RE.test(r.rackId || r.id));
    if (serverRacks.length === 0) {
      return { success: false, message: 'No server-backed racks to save' };
    }

    set({ isSavingLayout: true, saveLayoutError: null });

    let saved = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const rack of serverRacks) {
      const res = await get().saveRackLayoutToServer(rack.id, { suppressLoading: true });
      if (res.success) saved += 1;
      else {
        failed += 1;
        if (res.message) errors.push(`${rack.rackCode}: ${res.message}`);
      }
    }

    set({ isSavingLayout: false });

    if (failed === 0) {
      await get().reloadStoreLayout();
      return {
        success: true,
        message: `Saved ${saved} rack${saved === 1 ? '' : 's'}`,
        saved,
        failed,
      };
    }

    const message = errors.join('; ') || `Saved ${saved}, failed ${failed}`;
    set({ saveLayoutError: message });
    if (saved > 0) await get().reloadStoreLayout();
    return { success: false, message, saved, failed };
  },
  // fetchAllRacksFromServer: async () => {
  //   try {
  //     const data = await fetchAllRacksApi();
  //     if (!data || !data.isRequestSuccess) {
  //       return { success: false, message: data?.message || 'Failed to fetch racks' };
  //     }

  //     const backendRacks = data.data?.racks ?? data.data ?? [];
  //     const racks = (backendRacks || []).map((r: any) => {
  //       const width = Number(r.width) || 2.5;
  //       const depth = Number(r.depth) || 2;
  //       const sidesRaw = r.sides ?? (Array.isArray(r.sideIds) ? r.sideIds.map((s: any) => ({ sideId: s, rows: [] })) : []);
  //       const sides = (sidesRaw || []).map((s: any) => ({
  //         id: s.id || s.sideId || generateId(),
  //         sideId: s.sideId || s.id || (typeof s === 'string' ? s : generateId()),
  //         rows: (s.rows || []).map((row: any) => ({
  //           id: row.id || generateId(),
  //           height: Number(row.height) || 1.5,
  //           bins: (row.bins || []).map((b: any) => ({
  //             id: b.id || b.binId || generateId(),
  //             width: Number(b.width) || DEFAULT_BIN_WIDTH,
  //             depth: Number(b.depth) || DEFAULT_BIN_DEPTH,
  //             height: Number(b.height) || DEFAULT_BIN_HEIGHT,
  //             products: (b.products || []).map((p: any) => ({
  //               id: p.id || p.productId || generateId(),
  //               name: p.name || p.label || 'Product',
  //               color: p.color || '#2C5282',
  //               width: Number(p.width) || 0.15,
  //               height: Number(p.height) || 0.08,
  //               depth: Number(p.depth) || 0.2,
  //             })),
  //           })),
  //         })),
  //       }));

  //       return {
  //         id: r.id || generateId(),
  //         rackId: (r.rackId || r.id || generateId()).toString(),
  //         width,
  //         depth,
  //         position: { x: 0, y: 0, z: 0 },
  //         sides,
  //       } as Rack;
  //     });

  //     set((s) => ({ area: { ...s.area, racks } }));
  //     return { success: true };
  //   } catch (err) {
  //     return { success: false, message: 'Network or server error' };
  //   }
  // },
  updateDimensions: (entityId, type, values) => {
    if (type === "rack") {
      const state = get();
      const rack = state.area.racks.find((r) => r.id === entityId);
      if (!rack) return;
      const patched: Rack = { ...rack, ...values };
      if (values.width != null || values.depth != null) {
        const ow = Number(values.width ?? patched.outer?.width ?? patched.width) || patched.width;
        const od = Number(values.depth ?? patched.outer?.depth ?? patched.depth) || patched.depth;
        const oh =
          Number(patched.outer?.height ?? patched.customConfig?.outerHeight ?? 2) || 2;
        patched.outer = { width: ow, depth: od, height: oh };
        if (patched.customConfig) {
          patched.customConfig = {
            ...patched.customConfig,
            outerWidth: ow,
            outerDepth: od,
            outerHeight: oh,
          };
        }
      }
      const { rack: next, exceptions } = cascadeRescaleRack(patched);
      set({
        layoutCascadeExceptions: exceptions,
        area: {
          ...state.area,
          racks: state.area.racks.map((r) => (r.id === entityId ? next : r)),
        },
      });
      return;
    }

    set((state) => {
      if (type === "area") {
        return {
          area: {
            ...state.area,
            ...values,
          },
        };
      }
      if (type === "row") {
        return {
          area: {
            ...state.area,
            racks: state.area.racks.map((rack) => ({
              ...rack,
              sides: rack.sides.map((side) => ({
                ...side,
                rows: side.rows.map((row) =>
                  row.id === entityId ? { ...row, ...values } : row,
                ),
              })),
            })),
          },
        };
      }
      if (type === "bin") {
        return {
          area: {
            ...state.area,
            racks: state.area.racks.map((rack) => ({
              ...rack,
              sides: rack.sides.map((side) => ({
                ...side,
                rows: side.rows.map((row) => ({
                  ...row,
                  bins: row.bins.map((bin) =>
                    bin.id === entityId ? { ...bin, ...values } : bin,
                  ),
                })),
              })),
            })),
          },
        };
      }
      if (type === "product") {
        return {
          area: {
            ...state.area,
            racks: state.area.racks.map((rack) => ({
              ...rack,
              sides: rack.sides.map((side) => ({
                ...side,
                rows: side.rows.map((row) => ({
                  ...row,
                  bins: row.bins.map((bin) => ({
                    ...bin,
                    products: bin.products.map((product) =>
                      product.id === entityId
                        ? { ...product, ...values }
                        : product,
                    ),
                  })),
                })),
              })),
            })),
          },
        };
      }
      return state;
    });
  },
  updateRackPosition: (rackId, position) =>
    set((state) => {
      const rack = state.area.racks.find((r) => r.id === rackId);
      if (!rack) return state;

      const halfW = state.area.width / 2;
      const halfD = state.area.depth / 2;
      const minX = position.x - rack.width / 2;
      const maxX = position.x + rack.width / 2;
      const minZ = position.z - rack.depth / 2;
      const maxZ = position.z + rack.depth / 2;

      if (minX < -halfW || maxX > halfW || minZ < -halfD || maxZ > halfD) {
        return {
          ...state,
          moveRackError: `Rack would extend outside the warehouse floor (${state.area.width} m × ${state.area.depth} m). Choose a position inside the floor.`,
        };
      }

      const overlaps = state.area.racks.some((other) => {
        if (other.id === rackId) return false;
        const ox1 = other.position.x - other.width / 2;
        const ox2 = other.position.x + other.width / 2;
        const oz1 = other.position.z - other.depth / 2;
        const oz2 = other.position.z + other.depth / 2;
        return minX < ox2 && maxX > ox1 && minZ < oz2 && maxZ > oz1;
      });
      if (overlaps) {
        return {
          ...state,
          moveRackError:
            "Rack would overlap another rack. Choose a different position.",
        };
      }

      return {
        ...state,
        moveRackError: null,
        area: {
          ...state.area,
          racks: state.area.racks.map((r) =>
            r.id === rackId
              ? {
                ...r,
                position,
                quadrant: getQuadrantFromPosition(position.x, position.z),
                placement: {
                  position: { ...position },
                  rotation: r.rotation ?? { x: 0, y: 0, z: 0 },
                  snapMode: r.placement?.snapMode ?? 'wall',
                  quadrant: getQuadrantFromPosition(position.x, position.z),
                },
              }
              : r,
          ),
        },
      };
    }),
  setRackRotationY: (rackId, rotationY) =>
    set((state) => {
      const rack = state.area.racks.find((r) => r.id === rackId);
      if (!rack) return state;
      // Normalize to [-π, π] for stable display
      let y = rotationY;
      while (y > Math.PI) y -= Math.PI * 2;
      while (y < -Math.PI) y += Math.PI * 2;
      const rotation = { x: rack.rotation?.x ?? 0, y, z: rack.rotation?.z ?? 0 };
      return {
        ...state,
        moveRackError: null,
        area: {
          ...state.area,
          racks: state.area.racks.map((r) =>
            r.id === rackId
              ? {
                  ...r,
                  rotation,
                  placement: {
                    position: { ...r.position },
                    rotation: { ...rotation },
                    snapMode: r.placement?.snapMode ?? 'wall',
                    quadrant: r.quadrant ?? getQuadrantFromPosition(r.position.x, r.position.z),
                  },
                }
              : r,
          ),
        },
      };
    }),
  rotateRack: (rackId, deltaDegrees = 90) => {
    const state = get();
    const rack = state.area.racks.find((r) => r.id === rackId);
    if (!rack) return;
    const current = rack.rotation?.y ?? 0;
    const next = current + (deltaDegrees * Math.PI) / 180;
    get().setRackRotationY(rackId, next);
  },
  deleteRack: (rackId) =>
    set((state) => ({
      area: {
        ...state.area,
        racks: state.area.racks.filter((r) => r.id !== rackId),
      },
      selectedId: null,
      selectedType: null,
    })),
  deleteRackFromServer: async (rackId) => {
    const state = get();
    const rack = state.area.racks.find((r) => r.id === rackId);
    if (!rack) return { success: false, message: 'Rack not found' };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } catch (e) {
      // ignore
    }

    try {
      const serverRackId = rack.rackId || rack.id;
      const res = await fetch(`/api/racks/${encodeURIComponent(serverRackId)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.isRequestSuccess !== false && data?.success !== false) {
        set((s) => ({
          area: {
            ...s.area,
            racks: s.area.racks.filter((r) => r.id !== rackId),
          },
          selectedId: s.selectedId === rackId ? null : s.selectedId,
          selectedType: s.selectedId === rackId ? null : s.selectedType,
        }));
        return { success: true, message: data.message || 'Rack removed' };
      } else {
        return { success: false, message: data?.message || 'Failed to remove rack' };
      }
    } catch (err) {
      return { success: false, message: 'Network or server error' };
    }
  },
  deleteRow: (rowId) =>
    set((state) => ({
      area: {
        ...state.area,
        racks: state.area.racks.map((rack) => ({
          ...rack,
          sides: rack.sides.map((side) => ({
            ...side,
            rows: side.rows.filter((row) => row.id !== rowId),
          })),
        })),
      },
      selectedId: null,
      selectedType: null,
    })),
  deleteBin: (binId) =>
    set((state) => ({
      area: {
        ...state.area,
        racks: state.area.racks.map((rack) => ({
          ...rack,
          sides: rack.sides.map((side) => {
            const rowWithBin = side.rows.find((r) =>
              r.bins.some((b) => b.id === binId),
            );
            if (!rowWithBin) return side;

            return {
              ...side,
              rows: side.rows.map((row) => {
                if (!row.bins.some((b) => b.id === binId)) return row;

                const filteredBins = row.bins.filter((bin) => bin.id !== binId);
                const n = filteredBins.length;

                if (n === 0) return { ...row, bins: [] };

                // Recalculate dimensions for remaining bins
                const rowExtent1 = rack.width * 0.85;
                const rowExtent2 = rack.depth * 0.9;
                const normalizedWidth = rowExtent1 / 0.85;
                const normalizedDepth = rowExtent2 / 0.9;

                let binWidth: number;
                let binDepth: number;

                if (normalizedWidth >= normalizedDepth) {
                  binWidth = rowExtent1 / n;
                  binDepth = rowExtent2;
                } else {
                  binWidth = rowExtent1;
                  binDepth = rowExtent2 / n;
                }

                const updatedBins = filteredBins.map((b) => ({
                  ...b,
                  width: binWidth,
                  depth: binDepth,
                }));

                return { ...row, bins: updatedBins };
              }),
            };
          }),
        })),
      },
      selectedId: null,
      selectedType: null,
    })),
  deleteBinFromServer: async (binId) => {
    const serverBinId = resolveEntityId(binId);
    if (!serverBinId || !UUID_RE.test(serverBinId)) {
      // Local-only bin — just drop from scene
      get().deleteBin(binId);
      return { success: true, message: 'Bin removed locally' };
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers.Authorization = `Bearer ${t}`;
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch(`/api/bins/${encodeURIComponent(serverBinId)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.isRequestSuccess === false || data?.success === false) {
        return { success: false, message: data?.message || 'Failed to delete bin' };
      }
      get().deleteBin(binId);
      return { success: true, message: data?.message || 'Bin deleted' };
    } catch {
      return { success: false, message: 'Network or server error' };
    }
  },
  deleteBlueprintFromServer: async (blueprintId) => {
    const id = resolveEntityId(blueprintId) || blueprintId;
    if (!id || !UUID_RE.test(id)) {
      return { success: false, message: 'Invalid blueprint id' };
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers.Authorization = `Bearer ${t}`;
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch(`/api/blueprints/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.isRequestSuccess === false || data?.success === false) {
        return { success: false, message: data?.message || 'Failed to delete blueprint' };
      }
      return { success: true, message: data?.message || 'Blueprint deleted' };
    } catch {
      return { success: false, message: 'Network or server error' };
    }
  },
  deleteProduct: (productId) =>
    set((state) => ({
      area: {
        ...state.area,
        racks: state.area.racks.map((rack) => ({
          ...rack,
          sides: rack.sides.map((side) => ({
            ...side,
            rows: side.rows.map((row) => ({
              ...row,
              bins: row.bins.map((bin) => ({
                ...bin,
                products: bin.products.filter(
                  (p) =>
                    p.id !== productId &&
                    !p.id.startsWith(`${productId}::`) &&
                    resolveProductFacingId(p.id) !== productId,
                ),
              })),
            })),
          })),
        })),
      },
      selectedId: state.selectedId === productId ? null : state.selectedId,
      selectedType: state.selectedId === productId ? null : state.selectedType,
    })),
  clearBinProductsLocally: (binId) =>
    set((state) => ({
      area: {
        ...state.area,
        racks: state.area.racks.map((rack) => ({
          ...rack,
          sides: rack.sides.map((side) => ({
            ...side,
            rows: side.rows.map((row) => ({
              ...row,
              bins: row.bins.map((bin) =>
                bin.id === binId ? { ...bin, products: [] } : bin,
              ),
            })),
          })),
        })),
      },
      selectedId: state.selectedType === 'product' ? null : state.selectedId,
      selectedType: state.selectedType === 'product' ? null : state.selectedType,
    })),
  detachBinInventory: async (binId) => {
    const serverBinId = resolveEntityId(binId);
    if (!serverBinId || !UUID_RE.test(serverBinId)) {
      get().clearBinProductsLocally(binId);
      return { success: true, message: 'Cleared local inventory' };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch('/api/bin-inventory/detach', {
        method: 'POST',
        headers,
        body: JSON.stringify({ binId: serverBinId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.isRequestSuccess === false) {
        return {
          success: false,
          message: extractApiErrorMessage(data, 'Failed to detach product from inventory'),
        };
      }
      get().clearBinProductsLocally(binId);
      return { success: true, message: data?.message || 'Inventory detached' };
    } catch {
      return { success: false, message: 'Network error while detaching product' };
    }
  },
  deleteProductFromServer: async (productId) => {
    const catalogId = resolveProductFacingId(productId);
    const state = get();
    let binId: string | null = null;
    for (const rack of state.area.racks) {
      for (const side of rack.sides) {
        for (const row of side.rows) {
          for (const bin of row.bins) {
            if (
              bin.products.some(
                (p) => p.id === productId || p.id.startsWith(`${catalogId}::`) || p.id === catalogId,
              )
            ) {
              binId = bin.id;
              break;
            }
          }
          if (binId) break;
        }
        if (binId) break;
      }
      if (binId) break;
    }

    if (!binId) {
      get().deleteProduct(productId);
      return { success: true, message: 'Product removed locally' };
    }

    return get().detachBinInventory(binId);
  },
  assignRackPosmItems: async (rackId, payload, posmCatalog = {}) => {
    const rack = get().area.racks.find((r) => r.id === rackId || r.rackId === rackId);
    const serverRackId = rack?.rackId ?? rack?.id ?? rackId;
    if (!serverRackId || !UUID_RE.test(serverRackId)) {
      return { success: false, message: 'Rack has no server id yet' };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch(
        `/api/racks/${encodeURIComponent(serverRackId)}/posm-items`,
        { method: 'PUT', headers, body: JSON.stringify(payload) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.isRequestSuccess === false) {
        return { success: false, message: data?.message || 'Failed to assign POSM items' };
      }

      const responseShell = data?.data?.shell ?? data?.data ?? {};
      const posmFromCatalog = (id: string | null | undefined): RackSurfacePosm | null => {
        if (!id) return null;
        if (posmCatalog[id]) return posmCatalog[id];
        const fromShell =
          (responseShell.headerPosm?.id === id && responseShell.headerPosm) ||
          (responseShell.footerPosm?.id === id && responseShell.footerPosm) ||
          (responseShell.leftWallPosm?.id === id && responseShell.leftWallPosm) ||
          (responseShell.rightWallPosm?.id === id && responseShell.rightWallPosm);
        if (fromShell) return fromShell as RackSurfacePosm;
        for (const rack of get().area.racks) {
          for (const side of rack.sides) {
            for (const row of side.rows) {
              if (row.dividerPosm?.id === id) return row.dividerPosm;
            }
          }
          const shell = rack.shell;
          if (shell?.headerPosm?.id === id) return shell.headerPosm;
          if (shell?.footerPosm?.id === id) return shell.footerPosm;
          if (shell?.leftWallPosm?.id === id) return shell.leftWallPosm;
          if (shell?.rightWallPosm?.id === id) return shell.rightWallPosm;
        }
        return { id, name: 'POSM item', posmType: 'ShelfTalker' };
      };

      const hydratePosm = (
        fromApi: RackSurfacePosm | null | undefined,
        id: string | null | undefined,
        previous: RackSurfacePosm | null | undefined,
      ): RackSurfacePosm | null => {
        const base = fromApi ?? (id !== undefined ? posmFromCatalog(id) : previous) ?? null;
        if (!base) return null;
        const catalog = posmCatalog[base.id];
        return {
          ...base,
          imageUrl: base.imageUrl ?? catalog?.imageUrl ?? previous?.imageUrl ?? null,
          imageStorageKey:
            base.imageStorageKey ?? catalog?.imageStorageKey ?? previous?.imageStorageKey ?? null,
        };
      };

      set((s) => ({
        area: {
          ...s.area,
          racks: s.area.racks.map((r) => {
            if (r.id !== rackId && r.rackId !== serverRackId) return r;
            const shell = r.shell
              ? {
                  ...r.shell,
                  headerPosmItemId:
                    payload.headerPosmItemId !== undefined
                      ? payload.headerPosmItemId
                      : r.shell.headerPosmItemId,
                  footerPosmItemId:
                    payload.footerPosmItemId !== undefined
                      ? payload.footerPosmItemId
                      : r.shell.footerPosmItemId,
                  leftWallPosmItemId:
                    payload.leftWallPosmItemId !== undefined
                      ? payload.leftWallPosmItemId
                      : r.shell.leftWallPosmItemId,
                  rightWallPosmItemId:
                    payload.rightWallPosmItemId !== undefined
                      ? payload.rightWallPosmItemId
                      : r.shell.rightWallPosmItemId,
                  headerPosm: hydratePosm(
                    responseShell.headerPosm,
                    payload.headerPosmItemId !== undefined
                      ? payload.headerPosmItemId
                      : r.shell.headerPosmItemId,
                    r.shell.headerPosm,
                  ),
                  footerPosm: hydratePosm(
                    responseShell.footerPosm,
                    payload.footerPosmItemId !== undefined
                      ? payload.footerPosmItemId
                      : r.shell.footerPosmItemId,
                    r.shell.footerPosm,
                  ),
                  leftWallPosm: hydratePosm(
                    responseShell.leftWallPosm,
                    payload.leftWallPosmItemId !== undefined
                      ? payload.leftWallPosmItemId
                      : r.shell.leftWallPosmItemId,
                    r.shell.leftWallPosm,
                  ),
                  rightWallPosm: hydratePosm(
                    responseShell.rightWallPosm,
                    payload.rightWallPosmItemId !== undefined
                      ? payload.rightWallPosmItemId
                      : r.shell.rightWallPosmItemId,
                    r.shell.rightWallPosm,
                  ),
                }
              : {
                  wallThickness: 0.08,
                  walls: { back: true, left: true, right: true, frontGlass: false },
                  header: {
                    enabled: true,
                    width: null,
                    depth: null,
                    height: 0.25,
                    protrusion: null,
                    color: null,
                    emissive: null,
                  },
                  footer: {
                    enabled: true,
                    width: null,
                    depth: null,
                    height: 0.16,
                    protrusion: null,
                    color: null,
                    emissive: null,
                  },
                  frame: { cornerPosts: 4, topRail: true, innerFloor: true },
                  materials: { accentColor: null, wallColor: null, postColor: null },
                  headerPosmItemId: payload.headerPosmItemId ?? null,
                  footerPosmItemId: payload.footerPosmItemId ?? null,
                  leftWallPosmItemId: payload.leftWallPosmItemId ?? null,
                  rightWallPosmItemId: payload.rightWallPosmItemId ?? null,
                  headerPosm: hydratePosm(
                    responseShell.headerPosm,
                    payload.headerPosmItemId ?? null,
                    null,
                  ),
                  footerPosm: hydratePosm(
                    responseShell.footerPosm,
                    payload.footerPosmItemId ?? null,
                    null,
                  ),
                  leftWallPosm: hydratePosm(
                    responseShell.leftWallPosm,
                    payload.leftWallPosmItemId ?? null,
                    null,
                  ),
                  rightWallPosm: hydratePosm(
                    responseShell.rightWallPosm,
                    payload.rightWallPosmItemId ?? null,
                    null,
                  ),
                };

            let sides = r.sides;
            if (payload.rowPosmItems?.length) {
              const byRow = new Map(
                payload.rowPosmItems.map((rd) => [rd.rowId, rd.dividerPosmItemId]),
              );
              sides = r.sides.map((side) => ({
                ...side,
                rows: side.rows.map((row) => {
                  const rowKey = resolveEntityId(row.id) ?? row.id;
                  if (!byRow.has(rowKey)) return row;
                  const itemId = byRow.get(rowKey) ?? null;
                  return {
                    ...row,
                    dividerPosmItemId: itemId,
                    dividerPosm: itemId
                      ? hydratePosm(null, itemId, row.dividerPosm)
                      : null,
                  };
                }),
              }));
            }

            return { ...r, shell, sides };
          }),
        },
      }));

      return { success: true, message: 'POSM items updated' };
    } catch {
      return { success: false, message: 'Network error while assigning POSM items' };
    }
  },
  assignRowDividerPosm: async (rackId, rowId, posmItemId, hydrated) => {
    const rackRowId = resolveEntityId(rowId);
    if (!rackRowId || !UUID_RE.test(rackRowId)) {
      return { success: false, message: 'Row has no server id yet' };
    }
    const catalog = posmItemId && hydrated ? { [posmItemId]: hydrated } : undefined;
    return get().assignRackPosmItems(
      rackId,
      { rowPosmItems: [{ rowId: rackRowId, dividerPosmItemId: posmItemId }] },
      catalog,
    );
  },
  loadFromJSON: async (jsonData, onProgress) => {
    const startTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    set({
      isImporting: true,
      importProgress: 0,
      area: { width: DEFAULT_AREA_WIDTH, depth: DEFAULT_AREA_DEPTH, racks: [] }, // Clear existing area
    });

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // Generate product from ID
    const generateProductFromId = (productId: string): Product => {
      const colors = [
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#FFA07A",
        "#98D8C8",
        "#F7DC6F",
        "#BB8FCE",
        "#85C1E2",
        "#F8B739",
        "#52BE80",
        "#E74C3C",
        "#2C5282",
        "#9B59B6",
        "#1ABC9C",
        "#F39C12",
        "#16A085",
        "#E67E22",
        "#C0392B",
        "#8E44AD",
        "#1A365D",
      ];
      const hash = productId
        .split("")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const color = colors[hash % colors.length];
      return {
        id: productId,
        name: productId,
        color,
        width: 0.35,
        height: 0.35,
        depth: 0.35,
      };
    };

    // Extract generation blueprint (Fallback)
    const blueprint = jsonData.generationBlueprint || {
      origin: "center",
      rackRules: {
        rackSpacingCm: 120,
        defaultHeight: "standard",
      },
    };
    const expansionStrategy = blueprint.expansionStrategy || {};
    const doubleSidedUntilRack = expansionStrategy.doubleSidedUntilRack ?? 999;
    const thenConvertTo = (expansionStrategy.thenConvertTo || "singleSided") as
      | "singleSided"
      | "doubleSided";
    const layoutStyle = (blueprint.layoutStyle || "single_row") as
      | "single_row"
      | "double_row_aisle";
    const aisleWidthM = (
      blueprint.aisleWidthCm != null ? blueprint.aisleWidthCm / 100 : 3
    ) as number;

    // Sort racks by createdDate (chronological order)
    const sortedRacks = [...jsonData.layout.racks].sort((a, b) => {
      const dateA = new Date(a.createdDate || "1970-01-01").getTime();
      const dateB = new Date(b.createdDate || "1970-01-01").getTime();
      return dateA - dateB;
    });

    let totalRacks = 0;
    let totalRows = 0;
    let totalBins = 0;
    let totalProducts = 0;

    const racks: Rack[] = [];
    const rackWidth = DEFAULT_RACK_WIDTH;
    const rackDepth = DEFAULT_RACK_DEPTH;

    // Use rackSpacingCm from blueprint (convert cm to meters)
    const spacing = (blueprint.rackRules?.rackSpacingCm || 120) / 100;

    // Determine Direction (Robust Fallback)
    const rawDirection = (
      jsonData.layout?.direction ||
      jsonData.direction ||
      jsonData.generationBlueprint?.direction?.primaryAxis ||
      "NORTH"
    )
      .toString()
      .toUpperCase();

    // Normalize to valid set
    const direction = [
      "NORTH",
      "SOUTH",
      "EAST",
      "WEST",
      "NORTH_SOUTH",
      "EAST_WEST",
    ].includes(rawDirection)
      ? rawDirection
      : "NORTH";

    // Normalize legacy values
    const normalizedDirection =
      direction === "NORTH_SOUTH"
        ? "NORTH"
        : direction === "EAST_WEST"
          ? "EAST"
          : direction;

    // Calculate spacing stride
    const gap = spacing;
    let stride = 0;
    if (["NORTH", "SOUTH"].includes(normalizedDirection)) {
      stride = rackDepth + gap;
    } else {
      stride = rackWidth + gap;
    }

    // Calculate total steps for progress
    let totalSteps = 0;
    for (const jsonRack of sortedRacks) {
      for (const jsonSide of jsonRack.sides) {
        totalSteps += jsonSide.rows.length;
        for (const jsonRow of jsonSide.rows) {
          totalSteps += jsonRow.bins.length;
          for (const jsonBin of jsonRow.bins) {
            totalSteps += jsonBin.products.length;
          }
        }
      }
      totalSteps += 1;
    }

    let currentStep = 0;
    const updateProgress = (step: number) => {
      currentStep += step;
      const progress = (currentStep / totalSteps) * 100;
      set({ importProgress: progress });
      if (onProgress) onProgress(progress);
    };

    const N = sortedRacks.length;
    const mid = Math.ceil(N / 2); // first row count for double_row_aisle

    // Build racks incrementally - show each step on canvas
    for (let rackIndex = 0; rackIndex < sortedRacks.length; rackIndex++) {
      const jsonRack = sortedRacks[rackIndex];
      totalRacks++;

      // Apply expansionStrategy: from doubleSidedUntilRack onward, force singleSided if thenConvertTo says so
      let sidesToUse = jsonRack.sides;
      if (
        thenConvertTo === "singleSided" &&
        rackIndex >= doubleSidedUntilRack &&
        jsonRack.sides.length > 1
      ) {
        sidesToUse = [jsonRack.sides[0]];
      }

      let rackX = 0;
      let rackZ = 0;

      if (layoutStyle === "double_row_aisle") {
        const row = rackIndex < mid ? 0 : 1;
        const indexInRow = rackIndex < mid ? rackIndex : rackIndex - mid;
        const rowSize = row === 0 ? mid : N - mid;
        const offsetAlongAxis = (indexInRow - (rowSize - 1) / 2) * stride;
        const distFromAisle = aisleWidthM / 2;
        if (["NORTH", "SOUTH"].includes(normalizedDirection)) {
          rackZ = offsetAlongAxis;
          rackX =
            row === 0
              ? -(distFromAisle + rackWidth / 2)
              : distFromAisle + rackWidth / 2;
        } else {
          rackX = offsetAlongAxis;
          rackZ =
            row === 0
              ? -(distFromAisle + rackDepth / 2)
              : distFromAisle + rackDepth / 2;
        }
      } else {
        const offset = (rackIndex - (N - 1) / 2) * stride;
        switch (normalizedDirection) {
          case "NORTH":
            rackZ = -offset;
            rackX = 0;
            break;
          case "SOUTH":
            rackZ = offset;
            rackX = 0;
            break;
          case "EAST":
            rackX = offset;
            rackZ = 0;
            break;
          case "WEST":
            rackX = -offset;
            rackZ = 0;
            break;
        }
      }

      const rackCode = jsonRack.rack_code || `RACK-${jsonRack.rack_id}`;
      // Step 1: Create empty rack structure first (use sidesToUse for expansionStrategy)
      const newRack: Rack = {
        id: jsonRack.rack_id,
        rackId: jsonRack.rack_id,
        rackCode: rackCode,
        width: rackWidth,
        depth: rackDepth,
        height:
          jsonRack.height || blueprint.rackRules?.defaultHeight || "standard",
        position: { x: rackX, y: 0, z: rackZ },
        rotation: { x: 0, y: 0, z: 0 },
        sides: sidesToUse.map(
          (jsonSide: { side_id: string; rows?: unknown[] }, idx: number) => ({
            id: jsonSide.side_id,
            sideId: jsonSide.side_id,
            sideCode: jsonSide.side_id || `${rackCode}-S${idx + 1}`,
            rows: [],
          }),
        ),
      };

      racks.push(newRack);

      // Helper function to calculate area bounds from current racks
      const calculateAreaBounds = (currentRacks: Rack[]) => {
        if (currentRacks.length === 0) return { width: 60, depth: 60 };

        // Calculate max extent from center (0,0) to ensure racks fit
        let maxDistX = 30; // Minimum half-width
        let maxDistZ = 30; // Minimum half-depth

        currentRacks.forEach((r) => {
          // check corners of the rack
          const corners = [
            { x: r.position.x - r.width / 2, z: r.position.z - r.depth / 2 },
            { x: r.position.x + r.width / 2, z: r.position.z - r.depth / 2 },
            { x: r.position.x - r.width / 2, z: r.position.z + r.depth / 2 },
            { x: r.position.x + r.width / 2, z: r.position.z + r.depth / 2 },
          ];

          corners.forEach((c) => {
            maxDistX = Math.max(maxDistX, Math.abs(c.x));
            maxDistZ = Math.max(maxDistZ, Math.abs(c.z));
          });
        });

        // Add padding (e.g. 5 meters)
        return {
          width: maxDistX * 2 + 10,
          depth: maxDistZ * 2 + 10,
        };
      };

      // Update store - user sees empty rack appear
      const bounds = calculateAreaBounds(racks);
      set({
        area: {
          ...bounds,
          racks: [...racks],
        },
        importProgress: (currentStep / totalSteps) * 100,
      });

      await sleep(100); // Delay to see rack structure appear

      // Step 2: Add rows to each side (use sidesToUse so expansionStrategy is respected)
      for (const jsonSide of sidesToUse) {
        for (const jsonRow of jsonSide.rows) {
          totalRows++;

          // Create empty row
          const newRow: Row = {
            id: `${jsonSide.side_id}-R${jsonRow.row_number}`,
            height: 1.8,
            sided: "one",
            bins: [],
          };

          // Update store with new row - preserve all rack properties including position
          const updatedRacks = racks.map((rack) => {
            if (rack.id === jsonRack.rack_id) {
              return {
                ...rack, // This preserves position, width, depth, etc.
                sides: rack.sides.map((side) => {
                  if (side.sideId === jsonSide.side_id) {
                    return { ...side, rows: [...side.rows, newRow] };
                  }
                  return side;
                }),
              };
            }
            return rack;
          });

          const bounds2 = calculateAreaBounds(updatedRacks);
          set({
            area: {
              ...bounds2,
              racks: updatedRacks,
            },
          });

          racks.splice(0, racks.length, ...updatedRacks);
          updateProgress(1);
          await sleep(50); // Delay to see row appear

          // Step 3: Add bins to row
          for (const jsonBin of jsonRow.bins) {
            totalBins++;

            // Create bin with empty products first
            const binRules = blueprint.binRules || {
              widthCm: 200,
              depthCm: 50,
              heightCm: 10,
            };
            const wCm = jsonBin.widthCm ?? binRules.widthCm ?? 200;
            const dCm = jsonBin.depthCm ?? binRules.depthCm ?? 50;
            const hCm = jsonBin.heightCm ?? binRules.heightCm ?? 10;
            const newBin: Bin = {
              id: jsonBin.bin_id,
              width: (jsonBin.merged ? 400 : wCm) / 100,
              depth: dCm / 100,
              height: hCm / 100,
              products: [],
            };

            // Update store with new bin - preserve all rack properties
            const updatedRacks2 = racks.map((rack) => {
              if (rack.id === jsonRack.rack_id) {
                return {
                  ...rack, // Preserves position
                  sides: rack.sides.map((side) => {
                    if (side.sideId === jsonSide.side_id) {
                      return {
                        ...side,
                        rows: side.rows.map((row) => {
                          if (
                            row.id ===
                            `${jsonSide.side_id}-R${jsonRow.row_number}`
                          ) {
                            return { ...row, bins: [...row.bins, newBin] };
                          }
                          return row;
                        }),
                      };
                    }
                    return side;
                  }),
                };
              }
              return rack;
            });

            const bounds3 = calculateAreaBounds(updatedRacks2);
            set({
              area: {
                ...bounds3,
                racks: updatedRacks2,
              },
            });

            racks.splice(0, racks.length, ...updatedRacks2);
            updateProgress(1);
            await sleep(40); // Delay to see bin appear

            // Step 4: Add products to bin incrementally
            const products: Product[] = [];
            for (const productId of jsonBin.products) {
              totalProducts++;
              products.push(generateProductFromId(productId));

              // Update store with products being added one by one - preserve all rack properties
              const updatedRacks3 = racks.map((rack) => {
                if (rack.id === jsonRack.rack_id) {
                  return {
                    ...rack, // Preserves position
                    sides: rack.sides.map((side) => {
                      if (side.sideId === jsonSide.side_id) {
                        return {
                          ...side,
                          rows: side.rows.map((row) => {
                            if (
                              row.id ===
                              `${jsonSide.side_id}-R${jsonRow.row_number}`
                            ) {
                              return {
                                ...row,
                                bins: row.bins.map((bin) => {
                                  if (bin.id === jsonBin.bin_id) {
                                    return { ...bin, products: [...products] };
                                  }
                                  return bin;
                                }),
                              };
                            }
                            return row;
                          }),
                        };
                      }
                      return side;
                    }),
                  };
                }
                return rack;
              });

              const bounds4 = calculateAreaBounds(updatedRacks3);
              set({
                area: {
                  ...bounds4,
                  racks: updatedRacks3,
                },
                importProgress: (currentStep / totalSteps) * 100,
              });

              racks.splice(0, racks.length, ...updatedRacks3);
              updateProgress(1);
              await sleep(15); // Small delay to see products appearing
            }
          }
        }
      }
    }

    const endTime = performance.now();
    const renderTime = endTime - startTime;
    const totalAisles = jsonData.layout.aisles?.length || 0;

    // Calculate area bounds based on all racks - ROBUST RECALCULATION
    const allRackPositions = racks.map((r) => ({
      minX: r.position.x - r.width / 2,
      maxX: r.position.x + r.width / 2,
      minZ: r.position.z - r.depth / 2,
      maxZ: r.position.z + r.depth / 2,
    }));

    // Find max extent absolute to accommodate center origin
    let maxDistX = 30;
    let maxDistZ = 30;

    allRackPositions.forEach((p) => {
      maxDistX = Math.max(maxDistX, Math.abs(p.minX), Math.abs(p.maxX));
      maxDistZ = Math.max(maxDistZ, Math.abs(p.minZ), Math.abs(p.maxZ));
    });

    set({
      area: {
        width: maxDistX * 2 + 10,
        depth: maxDistZ * 2 + 10,
        racks,
      },
      renderTime,
      importSummary: {
        totalRacks,
        totalAisles,
        totalRows,
        totalBins,
        totalProducts,
      },
      selectedId: null,
      selectedType: null,
      isImporting: false,
      importProgress: 100,
    });
  },
  applyImportedPlanogram: (racks, area) => {
    const bounds = area ?? boundsFromRacks(racks);
    const summary = summarizeRacks(racks);
    set({
      area: {
        width: bounds.width,
        depth: bounds.depth,
        racks,
      },
      importSummary: {
        totalRacks: summary.racks,
        totalAisles: 0,
        totalRows: summary.rows,
        totalBins: summary.bins,
        totalProducts: summary.products,
      },
      selectedId: racks[0]?.id ?? null,
      selectedType: racks[0] ? 'rack' : null,
      isImporting: false,
      importProgress: 100,
    });
  },
  importPlanogramFromContent: async (content, filename) => {
    const result = importPlanogramContent(content, filename);
    set({ lastImportReport: result.report });
    if (result.success && result.racks.length > 0) {
      get().applyImportedPlanogram(result.racks, result.area);
    }
    return result;
  },
}));
