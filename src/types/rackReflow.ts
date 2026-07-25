/** Rack reflow API types (layout backend). All dimensions in meters. */

import type { HeaderFooterBand, RackShell } from '@/types/rackBlueprint'
import type { ShelfRowUtilization } from '@/types/shelfUtilization'

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
  header?: HeaderFooterBand | null
  footer?: HeaderFooterBand | null
  frame?: RackShell['frame'] | null
  materials?: RackShell['materials'] | null
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
  /** Per-row face utilization after reflow (when backend returns it). */
  rowUtilizations?: ShelfRowUtilization[]
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
  rowUtilizations?: ShelfRowUtilization[]
}

export interface MultiRackReflowResponse {
  targets: MultiRackReflowTargetResult[]
}
