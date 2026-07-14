/** Rack reflow API types (layout backend). All dimensions in meters. */

export interface ReflowOuterPatch {
  width?: number | null
  depth?: number | null
  height?: number | null
}

export interface ReflowShellPatch {
  wallThickness?: number | null
  walls?: {
    back?: boolean
    left?: boolean
    right?: boolean
    frontGlass?: boolean
  } | null
  header?: Record<string, unknown> | null
  footer?: Record<string, unknown> | null
  frame?: Record<string, unknown> | null
  materials?: Record<string, unknown> | null
  headerPosmItemId?: string | null
  footerPosmItemId?: string | null
  leftWallPosmItemId?: string | null
  rightWallPosmItemId?: string | null
}

export interface RackReflowRequest {
  outer?: ReflowOuterPatch
  shell?: ReflowShellPatch
}

export interface ReflowQuantityChange {
  binId: string
  skuId?: string | null
  skuName?: string | null
  fromQuantity?: number | null
  toQuantity?: number | null
  fromMaxQuantity?: number | null
  toMaxQuantity?: number | null
}

export interface ReflowGeometryChange {
  entityId: string
  field: string
  from?: number | null
  to?: number | null
}

export type ReflowExceptionCode =
  | 'SkuDoesNotFit'
  | 'MissingDimensions'
  | 'RowSpanOverflow'
  | 'BinWidthsOverflow'
  | 'RowHeightsOverflow'
  | string

export interface ReflowException {
  code?: ReflowExceptionCode
  message: string
  binId?: string | null
  skuId?: string | null
  skuName?: string | null
  rowId?: string | null
}

export interface RackReflowResult {
  quantityChanges: ReflowQuantityChange[]
  geometryChanges: ReflowGeometryChange[]
  exceptions: ReflowException[]
}

/** @deprecated Use RackReflowResult */
export type RackReflowPreview = RackReflowResult

export interface MultiRackReflowRequest {
  targetRackIds: string[]
}

export type MultiRackReflowTargetStatus =
  | 'ready'
  | 'needsAttention'
  | 'blocked'
  | 'applied'

export interface MultiRackReflowTargetResult {
  rackId: string
  storeId: string
  status: MultiRackReflowTargetStatus
  outer?: ReflowOuterPatch | null
  quantityChanges: ReflowQuantityChange[]
  geometryChanges: ReflowGeometryChange[]
  exceptions: ReflowException[]
  warnings?: string[]
  errors?: string[]
}

export interface MultiRackReflowResponse {
  targets: MultiRackReflowTargetResult[]
}
