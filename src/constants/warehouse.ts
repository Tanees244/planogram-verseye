/** Global warehouse scale — floor, building shell, and default area size. */
export const WAREHOUSE_SCALE = 1.5

export const BASE_AREA_SIZE = 50
export const DEFAULT_AREA_WIDTH = BASE_AREA_SIZE * WAREHOUSE_SCALE
export const DEFAULT_AREA_DEPTH = BASE_AREA_SIZE * WAREHOUSE_SCALE

/** Base building height (m) before scale — ground + upper floor. */
export const BASE_BUILDING_HEIGHT = 8
export const BUILDING_HEIGHT = BASE_BUILDING_HEIGHT * WAREHOUSE_SCALE
