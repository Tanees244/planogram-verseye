/** Rack publish + reflow API types (layout backend). All dimensions in meters. */

export interface ReflowOuterPatch {
  width?: number;
  depth?: number;
  height?: number;
}

export interface ReflowShellPatch {
  wallThickness?: number;
}

export interface RackReflowRequest {
  outer?: ReflowOuterPatch;
  shell?: ReflowShellPatch;
}

export interface ReflowQuantityChange {
  binId: string;
  skuId: string;
  skuName?: string;
  fromQuantity: number;
  toQuantity: number;
  fromMaxQuantity?: number;
  toMaxQuantity?: number;
}

export interface ReflowGeometryChange {
  entityId: string;
  field: string;
  from: number;
  to: number;
}

export type ReflowExceptionCode =
  | 'SkuDoesNotFit'
  | 'RowSpanOverflow'
  | 'BinWidthsOverflow'
  | 'RowHeightsOverflow'
  | string;

export interface ReflowException {
  code?: ReflowExceptionCode;
  message: string;
  binId?: string;
  skuId?: string;
  skuName?: string;
  rowId?: string;
}

export interface RackReflowPreview {
  quantityChanges: ReflowQuantityChange[];
  geometryChanges: ReflowGeometryChange[];
  exceptions: ReflowException[];
}

export interface RackPublishRequest {
  storeIds: string[];
  rackCode: string;
  blueprintName?: string | null;
}

export type RackPublishStoreStatus = 'ready' | 'blocked';

export interface RackPublishStorePreview {
  storeId: string;
  status: RackPublishStoreStatus;
  rackPreview?: {
    outer?: { width?: number; depth?: number; height?: number };
    rowCount?: number;
    binCount?: number;
    skuCount?: number;
    [key: string]: unknown;
  } | null;
  warnings?: string[];
  errors?: string[];
}

export interface RackPublishPreviewResult {
  stores: RackPublishStorePreview[];
}

export type RackPublishResultStatus = 'created' | 'blocked';

export interface RackPublishStoreResult {
  storeId: string;
  status: RackPublishResultStatus;
  createdRackId?: string | null;
  errors?: string[];
  warnings?: string[];
}

export interface RackPublishResult {
  results: RackPublishStoreResult[];
}
