/** Rack publish API types (layout backend). All dimensions in meters. */

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
