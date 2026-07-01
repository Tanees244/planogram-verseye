import { create } from "zustand";
import { resolveEntityId } from "@/utils/storeLayoutLoader";
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
  quantity?: number;
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
  sided?: RowSided;
  bins: Bin[];
}

export interface RackSide {
  id: string;
  sideId: string;
  sideCode: string;
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
  plankType: string;
  sided?: RackSided;
  rackCode?: string;
  globalLocationId?: string;
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
  selectedId: string | null;
  selectedType: "area" | "rack" | "row" | "bin" | "product" | null;
  isPlacingRack: boolean;
  pendingRackParams: PendingRackParams | null;
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
  addRack: (
    position?: { x: number; y: number; z: number },
    dimensions?: {
      width: number;
      depth: number;
      plankType: string;
      sided?: RackSided;
    },
  ) => void;
  addRackToServer: (
    position?: { x: number; y: number; z: number },
    dimensions?: {
      width: number;
      depth: number;
      plankType: string;
      sided?: RackSided;
      rackCode?: string;
    },
    globalLocationId?: string,
  ) => Promise<{ success: boolean; message: string }>;
  addRow: (rackId: string, height?: number) => void;
  addRowToServer: (
    rackId: string,
    height?: number,
    note?: string,
  ) => Promise<{ success: boolean; message: string }>;
  addBinToServer: (
    rowId: string,
    rowExtent1?: number,
    rowExtent2?: number,
    rowHeight?: number,
    binName?: string,
  ) => Promise<{ success: boolean; message: string; binId?: string }>;
  addBin: (
    rowId: string,
    rowExtent1?: number,
    rowExtent2?: number,
    rowHeight?: number,
    binName?: string,
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
  canProductFitInBin: (
    binId: string,
    product: { width: number; depth: number; height: number },
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
  deleteRack: (rackId: string) => void;
  deleteRackFromServer: (rackId: string) => Promise<{ success: boolean; message: string }>;
  deleteRow: (rowId: string) => void;
  deleteBin: (binId: string) => void;
  deleteProduct: (productId: string) => void;
  loadFromJSON: (
    jsonData: any,
    onProgress?: (progress: number) => void,
  ) => Promise<void>;
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

// Default product size (small enough to fit in default bin); in meters
const createProduct = (overrides?: Partial<Product>): Product => ({
  id: generateId(),
  name: `Product ${Math.floor(Math.random() * 1000)}`,
  color: `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`,
  width: 0.15,
  height: 0.08,
  depth: 0.2,
  ...overrides,
});

// Bins = containers on the row that hold products. Default size when no row dimensions given.
const DEFAULT_BIN_WIDTH = 2;
const DEFAULT_BIN_DEPTH = 0.5;
const DEFAULT_BIN_HEIGHT = 0.12;

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
  height: height ?? 1.5,
  sided: sided ?? "one",
  bins: [],
});

const createRack = (
  position?: { x: number; y: number; z: number },
  dimensions?: {
    width: number;
    depth: number;
    plankType: string;
    sided?: RackSided;
    rackCode?: string;
  },
): Rack => {
  const sided = dimensions?.sided ?? "one";
  const rackCode = dimensions?.rackCode ?? `RACK-${generateId().toUpperCase()}`;
  const sides: RackSide[] =
    sided === "two"
      ? [
        { id: generateId(), sideId: "Side1", sideCode: `${rackCode}-S1`, rows: [] },
        { id: generateId(), sideId: "Side2", sideCode: `${rackCode}-S2`, rows: [] },
      ]
      : [{ id: generateId(), sideId: "Side1", sideCode: `${rackCode}-S1`, rows: [] }];
  const rackPosition = position || { x: 0, y: 0, z: 0 };
  return {
    id: generateId(),
    rackId: generateId(),
    rackCode,
    width: dimensions?.width ?? 2.5,
    depth: dimensions?.depth ?? 20,
    height: dimensions?.plankType ?? "standard",
    position: rackPosition,
    rotation: { x: 0, y: 0, z: 0 },
    sides,
    isDoubleSided: sided === "two",
    quadrant: getQuadrantFromPosition(rackPosition.x, rackPosition.z),
  };
};

export const usePlanogramStore = create<PlanogramState>((set, get) => ({
  area: {
    width: 50,
    depth: 50,
    racks: [],
  },
  viewMode: "advanced",
  selectedId: null,
  selectedType: null,
  isPlacingRack: false,
  pendingRackParams: null,
  renderTime: null,
  importSummary: null,
  isImporting: false,
  importProgress: 0,
  addProductError: null,
  addRackError: null,
  isAddingRack: false,
  editingRackId: null,
  moveRackError: null,
  selectedStoreId: null,
  selectedStoreName: null,
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
      selectedId: null,
      selectedType: null,
      area: { ...s.area, racks: [] },
    }));
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelected: (id, type) => set({ selectedId: id, selectedType: type }),
  setIsPlacingRack: (value) => set({ isPlacingRack: value }),
  setPendingRackParams: (params) => set({ pendingRackParams: params }),
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
      const width = finalDims?.width ?? 2.5;
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
  addRackToServer: async (position, dimensions, globalLocationId) => {
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

    const width = finalDims?.width ?? 2.5;
    const depth = finalDims?.depth ?? 20;
    const pos = position ?? { x: 0, y: 0, z: 0 };

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

    const minX = pos.x - width / 2;
    const maxX = pos.x + width / 2;
    const minZ = pos.z - depth / 2;
    const maxZ = pos.z + depth / 2;

    if (minX < -halfW || maxX > halfW || minZ < -halfD || maxZ > halfD) {
      const msg = `Rack would extend outside the warehouse floor (${state.area.width} m × ${state.area.depth} m).`;
      set({ addRackError: msg });
      return { success: false, message: msg };
    }

    set({ isAddingRack: true, addRackError: null });

    try {
      // Build payload matching backend expectations (new layout API uses storeId)
      const payload = {
        storeId: globalLocationId || finalDims?.globalLocationId || state.selectedId,
        rackCode: finalDims?.rackCode || `RACK-${Date.now()}`,
        height: depth,
        width: width,
        isDoubleSided: (finalDims?.sided || "one") === "two",
      };

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
        const rack = createRack(pos, finalDims ?? undefined);
        rack.isDoubleSided = (finalDims?.sided || "one") === "two";
        try {
          const returned = data.data ?? {};
          if (returned.rackId) {
            rack.rackId = returned.rackId;
          }
          if (Array.isArray(returned.sideIds) && returned.sideIds.length > 0) {
            rack.sides = rack.sides.map((side, idx) => ({
              ...side,
              sideId: returned.sideIds[idx] ?? side.sideId,
            }));
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
          isAddingRack: false,
          addRackError: null,
        }));
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
  addRowToServer: async (rackId, height = 1.5, note) => {
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

    const sideResults: { success: boolean; message: string; returnedId?: string; sideIndex: number }[] = [];

    for (let i = 0; i < rack.sides.length; i++) {
      const side = rack.sides[i];
      const rackSideId = side.sideId;
      if (!rackSideId) {
        sideResults.push({ success: false, message: 'Missing rack side id', sideIndex: i });
        continue;
      }

      try {
        const res = await fetch('/api/racks/add-row-by-side', {
          method: 'POST',
          headers,
          body: JSON.stringify({ rackSideId, note: note ?? undefined, height }),
        });
        const data = await res.json();
        if (data?.isRequestSuccess) {
          const returnedId = resolveEntityId(data.data);
          sideResults.push({ success: true, message: data.message || 'OK', returnedId, sideIndex: i });
        } else {
          sideResults.push({ success: false, message: data?.message || 'Failed', sideIndex: i });
        }
      } catch (err) {
        sideResults.push({ success: false, message: 'Network error', sideIndex: i });
      }
    }

    // Apply successful results to local state
    const appliedCount = sideResults.filter((s) => s.success).length;
    if (appliedCount === 0) {
      return { success: false, message: sideResults.map((s) => s.message).join('; ') };
    }

    set((s) => {
      const racks = s.area.racks.map((r) => {
        if (r.id !== rackId) return r;
        const newSides = r.sides.map((side, idx) => {
          const result = sideResults.find((sr) => sr.sideIndex === idx && sr.success);
          if (!result) return side;
          const newRow = createRow(height, r.sides.length === 2 ? 'two' : 'one');
          if (result.returnedId) newRow.id = result.returnedId;
          return { ...side, rows: [...side.rows, newRow] };
        });
        return { ...r, sides: newSides };
      });
      return { ...s, area: { ...s.area, racks } };
    });

    return { success: true, message: `Added ${appliedCount} row(s)` };
  },
  addBinToServer: async (rowId: string, rowExtent1?: number, rowExtent2?: number, rowHeight?: number, binName?: string) => {
    const rackRowId = resolveEntityId(rowId);
    if (!rackRowId) {
      return { success: false, message: 'Invalid row id' };
    }

    const state = get();
    // find the row
    let found = false;
    for (const rack of state.area.racks) {
      for (const side of rack.sides) {
        for (const row of side.rows) {
          if (resolveEntityId(row.id) === rackRowId) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) return { success: false, message: 'Row not found' };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils');
      const t = getPlanogramTokenFromCookie();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    } catch (e) {
      // ignore
    }

    try {
      const payload: Record<string, any> = { rackRowId };
      if (binName != null) payload.binName = binName;

      const res = await fetch('/api/bins/add-by-row', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data?.isRequestSuccess) {
        return { success: false, message: data?.message || 'Failed to add bin' };
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
              const useRowDimensions = rowExtent1 != null && rowExtent2 != null;
              const binHeightUse = rowHeight ?? DEFAULT_BIN_HEIGHT;
              const n = row.bins.length + 1;
              let binWidth: number;
              let binDepth: number;
              if (useRowDimensions && rowExtent1 != null && rowExtent2 != null) {
                if (n === 1) {
                  binWidth = rowExtent1;
                  binDepth = rowExtent2;
                } else {
                  const normalizedWidth = rowExtent1 / 0.85;
                  const normalizedDepth = rowExtent2 / 0.9;
                  if (normalizedWidth >= normalizedDepth) {
                    binWidth = rowExtent1 / n;
                    binDepth = rowExtent2;
                  } else {
                    binWidth = rowExtent1;
                    binDepth = rowExtent2 / n;
                  }
                }
              } else {
                binWidth = DEFAULT_BIN_WIDTH;
                binDepth = DEFAULT_BIN_DEPTH;
              }
              const newBin = createBin({ width: binWidth, depth: binDepth, height: binHeightUse });
              newBin.id = returnedId;
              if (binName) newBin.binName = binName;
              const updatedBins = row.bins.map((b) => ({ ...b, width: binWidth, depth: binDepth, height: binHeightUse }));
              return { ...row, bins: [...updatedBins, newBin] };
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
  addBin: (rowId: string, rowExtent1?: number, rowExtent2?: number, rowHeight?: number, binName?: string) =>
    set((state) => {
      const useRowDimensions = rowExtent1 != null && rowExtent2 != null;
      const binHeightUse = rowHeight ?? DEFAULT_BIN_HEIGHT;

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
  canProductFitInBin: (binId, product) => {
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
    if (
      product.width > bin.width ||
      product.depth > bin.depth ||
      product.height > bin.height
    ) {
      return {
        fits: false,
        reason: `Product (${(product.width * 100).toFixed(0)}×${(product.depth * 100).toFixed(0)}×${(product.height * 100).toFixed(0)} cm) exceeds bin (${(bin.width * 100).toFixed(0)}×${(bin.depth * 100).toFixed(0)}×${(bin.height * 100).toFixed(0)} cm)`,
      };
    }
    const usedWidth = bin.products.reduce((sum, p) => sum + p.width, 0);
    if (usedWidth + product.width > bin.width) {
      return {
        fits: false,
        reason: `No space: used ${(usedWidth * 100).toFixed(0)} cm of ${(bin.width * 100).toFixed(0)} cm width; product needs ${(product.width * 100).toFixed(0)} cm more`,
      };
    }
    return { fits: true };
  },
  addProduct: (binId, productOverrides) => {
    const state = get();
    const product = createProduct(productOverrides);
    const check = get().canProductFitInBin(binId, product);
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
              bins: row.bins.map((bin) =>
                bin.id === binId
                  ? { ...bin, products: [...bin.products, product] }
                  : bin,
              ),
            })),
          })),
        })),
      },
    }));
    return { success: true };
  },
  attachProductToBin: async () => {
    return get().reloadStoreLayout();
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
  //               color: p.color || '#3498db',
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
  updateDimensions: (entityId, type, values) =>
    set((state) => {
      if (type === "area") {
        return {
          area: {
            ...state.area,
            ...values,
          },
        };
      }
      if (type === "rack") {
        return {
          area: {
            ...state.area,
            racks: state.area.racks.map((rack) =>
              rack.id === entityId ? { ...rack, ...values } : rack,
            ),
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
    }),
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
              }
              : r,
          ),
        },
      };
    }),
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
      const res = await fetch('/api/racks/removeRacks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ rackId: rack.rackId || rack.id }),
      });
      const data = await res.json();

      if (data && data.isRequestSuccess) {
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
                products: bin.products.filter((p) => p.id !== productId),
              })),
            })),
          })),
        })),
      },
      selectedId: null,
      selectedType: null,
    })),
  loadFromJSON: async (jsonData, onProgress) => {
    const startTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    set({
      isImporting: true,
      importProgress: 0,
      area: { width: 50, depth: 50, racks: [] }, // Clear existing area
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
        "#3498DB",
        "#9B59B6",
        "#1ABC9C",
        "#F39C12",
        "#16A085",
        "#E67E22",
        "#C0392B",
        "#8E44AD",
        "#2980B9",
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
    const rackWidth = 2.5;
    const rackDepth = 25;

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
}));
