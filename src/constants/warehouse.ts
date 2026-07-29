/**
 * Global warehouse / building shell scale.
 * Floor footprint defaults to a realistic mini warehouse: 30 × 20 × 8 m
 * (see docs/REALISTIC_DIMENSIONS.md and src/constants/dimensions.ts).
 */
import {
  DEFAULT_WAREHOUSE_DEPTH,
  DEFAULT_WAREHOUSE_HEIGHT,
  DEFAULT_WAREHOUSE_WIDTH,
} from '@/constants/dimensions'

/** Kept at 1 so fixture / product meters match real-world docs 1:1. */
export const WAREHOUSE_SCALE = 1

export const DEFAULT_AREA_WIDTH = DEFAULT_WAREHOUSE_WIDTH
export const DEFAULT_AREA_DEPTH = DEFAULT_WAREHOUSE_DEPTH

/** Building wall / roof height (m). */
export const BASE_BUILDING_HEIGHT = DEFAULT_WAREHOUSE_HEIGHT
export const BUILDING_HEIGHT = BASE_BUILDING_HEIGHT * WAREHOUSE_SCALE

/**
 * Ground-floor retail ceiling height.
 * Uses full warehouse height for a single-level store view;
 * BuildingExterior may still split floors visually.
 */
export const RETAIL_FLOOR_HEIGHT = 4.5 * WAREHOUSE_SCALE

/** Target fixture height for wall-mounted units (clearance below ceiling). */
export const RETAIL_FIXTURE_HEIGHT = Math.min(
  RETAIL_FLOOR_HEIGHT - 0.35,
  2.2,
)

/** How close (m) a click must be to snap a rack against a perimeter wall. */
export const WALL_SNAP_THRESHOLD = 1.25 * Math.max(1, WAREHOUSE_SCALE)
