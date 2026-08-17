/**
 * Realistic starting dimensions for warehouse / planogram scenes (meters).
 * See docs/REALISTIC_DIMENSIONS.md
 */

/** Default store / warehouse floor footprint. */
export const DEFAULT_WAREHOUSE_WIDTH = 42
export const DEFAULT_WAREHOUSE_DEPTH = 28
export const DEFAULT_WAREHOUSE_HEIGHT = 8

/** Standard pallet / gondola bay (warehouse-style starting rack). */
export const DEFAULT_RACK_WIDTH = 2.7
export const DEFAULT_RACK_DEPTH = 1.1
export const DEFAULT_RACK_HEIGHT = 6
/** Minimum outer footprint when creating / placing a rack (meters). */
export const MIN_RACK_WIDTH = 0.4
export const MIN_RACK_DEPTH = 0.3
export const DEFAULT_SHELF_LEVELS = 4

/** Retail grocery shelf bay. */
export const GROCERY_SHELF_WIDTH = 1.2
export const GROCERY_SHELF_DEPTH = 0.55
export const GROCERY_SHELF_HEIGHT = 2.0
export const GROCERY_SHELF_SPACING = 0.35

/** End-cap promotional. */
export const END_CAP_WIDTH = 0.9
export const END_CAP_DEPTH = 0.5
export const END_CAP_HEIGHT = 1.8

/** Euro pallet footprint. */
export const EURO_PALLET_LENGTH = 1.2
export const EURO_PALLET_WIDTH = 0.8
export const EURO_PALLET_HEIGHT = 0.144

/** Typical aisle clearances. */
export const AISLE_WALKING = 1.2
export const AISLE_CART = 2.2
export const AISLE_FORKLIFT = 3.5

/** White shelf board (row floor mesh). Center Y is `-rowHeight/2 + SHELF_BOARD_CENTER_Y`. */
export const SHELF_BOARD_THICKNESS = 0.06
export const SHELF_BOARD_CENTER_Y = 0.03

/**
 * Dark front price-rail / black lip on each shelf (meters).
 * Center Y is `-rowHeight/2 + SHELF_FRONT_LIP_CENTER_Y`.
 * Center Z is the shopper-facing shelf front.
 */
export const SHELF_FRONT_LIP_HEIGHT = 0.08
export const SHELF_FRONT_LIP_DEPTH = 0.06
export const SHELF_FRONT_LIP_CENTER_Y = 0.06
/** Bin front face sits this far behind the shelf front (toward products). */
export const SHELF_BIN_FRONT_INSET = 0.04

/** Default bin on a retail shelf (one bay section). */
export const DEFAULT_BIN_WIDTH = 0.9
export const DEFAULT_BIN_DEPTH = 0.45
export const DEFAULT_BIN_HEIGHT = 0.35

/**
 * Default product when catalog dims are missing — approx. 1 L milk bottle.
 * width × depth × height
 */
export const DEFAULT_PRODUCT_WIDTH = 0.08
export const DEFAULT_PRODUCT_DEPTH = 0.08
export const DEFAULT_PRODUCT_HEIGHT = 0.27

export interface ProductSizePreset {
  id: string
  label: string
  /** Facing width (m) */
  width: number
  /** Front-to-back depth (m) */
  depth: number
  /** Vertical height (m) */
  height: number
}

/** Quick-fill presets for Create SKU / product forms (meters). */
export const PRODUCT_SIZE_PRESETS: ProductSizePreset[] = [
  {
    id: 'milk-1l',
    label: 'Milk 1 L',
    width: 0.08,
    depth: 0.08,
    height: 0.27,
  },
  {
    id: 'milk-2l',
    label: 'Milk 2 L',
    width: 0.11,
    depth: 0.11,
    height: 0.31,
  },
  {
    id: 'water-500ml',
    label: 'Water 500 mL',
    width: 0.065,
    depth: 0.065,
    height: 0.22,
  },
  {
    id: 'water-15l',
    label: 'Water 1.5 L',
    width: 0.09,
    depth: 0.09,
    height: 0.33,
  },
  {
    id: 'can-330',
    label: 'Can 330 mL',
    width: 0.066,
    depth: 0.066,
    height: 0.12,
  },
  {
    id: 'soda-15l',
    label: 'Soft drink 1.5 L',
    width: 0.095,
    depth: 0.095,
    height: 0.33,
  },
  {
    id: 'cereal',
    label: 'Cereal box',
    width: 0.2,
    depth: 0.065,
    height: 0.3,
  },
  {
    id: 'chips',
    label: 'Chips packet',
    width: 0.18,
    depth: 0.06,
    height: 0.3,
  },
  {
    id: 'bread',
    label: 'Bread loaf',
    width: 0.24,
    depth: 0.12,
    height: 0.12,
  },
  {
    id: 'eggs-12',
    label: 'Eggs 12-pack',
    width: 0.31,
    depth: 0.11,
    height: 0.07,
  },
  {
    id: 'oil-1l',
    label: 'Cooking oil 1 L',
    width: 0.09,
    depth: 0.09,
    height: 0.27,
  },
  {
    id: 'tea-box',
    label: 'Tea box (12×8×5 cm)',
    width: 0.12,
    depth: 0.08,
    height: 0.05,
  },
  {
    id: 'carton-milk-12',
    label: 'Carton 12×1 L milk',
    width: 0.4,
    depth: 0.3,
    height: 0.28,
  },
]

/** Sample GLB shipped in /public/models for local demos. */
export const DEMO_PRODUCT_GLB = '/models/tapal_green_tea_box.glb'

export interface DemoProductModel {
  id: string
  label: string
  url: string
  /** Suggested catalog dims in meters (W × D × H). */
  width: number
  depth: number
  height: number
  /** Prefill create-SKU name when empty. */
  suggestedName?: string
  suggestedCode?: string
}

/** Local demo .glb options shown while creating a SKU. */
export const DEMO_PRODUCT_MODELS: DemoProductModel[] = [
  {
    id: 'tapal-tea',
    label: 'Tapal tea box',
    url: '/models/tapal_green_tea_box.glb',
    width: 0.12,
    depth: 0.08,
    height: 0.05,
    suggestedName: 'Tapal Green Tea',
    suggestedCode: 'TAPAL-TEA-01',
  },
  {
    id: 'almarai-milk-a',
    label: 'Almarai milk A',
    url: '/models/almarai_milk_bottle_a.glb',
    width: 0.08,
    depth: 0.08,
    height: 0.27,
    suggestedName: 'Almarai Fresh Milk 1 L',
    suggestedCode: 'ALM-MILK-01',
  },
  {
    id: 'almarai-milk-b',
    label: 'Almarai milk B',
    url: '/models/almarai_milk_bottle_b.glb',
    width: 0.08,
    depth: 0.08,
    height: 0.27,
    suggestedName: 'Almarai Fresh Milk 1 L',
    suggestedCode: 'ALM-MILK-02',
  },
  {
    id: 'almarai-milk-c',
    label: 'Almarai milk C',
    url: '/models/almarai_milk_bottle_c.glb',
    width: 0.09,
    depth: 0.09,
    height: 0.28,
    suggestedName: 'Almarai Fresh Milk',
    suggestedCode: 'ALM-MILK-03',
  },
  {
    id: 'almarai-yoghurt',
    label: 'Almarai yoghurt',
    url: '/models/almarai_yoghurt.glb',
    width: 0.09,
    depth: 0.09,
    height: 0.12,
    suggestedName: 'Almarai Yoghurt',
    suggestedCode: 'ALM-YOG-01',
  },
  {
    id: 'lusine-bread',
    label: "L'usine sliced bread",
    url: '/models/lusine_sliced_bread.glb',
    width: 0.24,
    depth: 0.12,
    height: 0.12,
    suggestedName: "L'usine Sliced Bread",
    suggestedCode: 'LUS-BRD-01',
  },
]


export function presetToFormStrings(preset: ProductSizePreset): {
  width: string
  depth: string
  height: string
} {
  return {
    width: String(preset.width),
    depth: String(preset.depth),
    height: String(preset.height),
  }
}
