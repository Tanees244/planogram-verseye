/** Config for parametric custom racks (header, footer, walls, inner/outer dims). */

import { RETAIL_FIXTURE_HEIGHT, WAREHOUSE_SCALE } from '@/constants/warehouse'

export interface CustomRackSection {
  enabled: boolean
  height: number
  /** Horizontal span (m). 0 = match outer width. */
  width: number
  /** Front-to-back span (m). 0 = preset default from outer depth. */
  depth: number
  /** Extra forward extension beyond depth (legacy / fine-tune). */
  protrusion: number
  color: string
  emissive?: string
}

export interface CustomRackWalls {
  back: boolean
  left: boolean
  right: boolean
  /** Glass door panel on front (-Z face). */
  frontGlass: boolean
}

export type CustomRackPreset = 'END_CAP' | 'REFRIGERATED' | 'CUSTOM'

export interface CustomRackConfig {
  preset: CustomRackPreset
  outerWidth: number
  outerDepth: number
  outerHeight: number
  wallThickness: number
  header: CustomRackSection
  footer: CustomRackSection
  walls: CustomRackWalls
  shelfCount: number
  shelfThickness: number
  accentColor: string
  /** When true, rack has shelves on both faces (center divider). */
  isDoubleSided?: boolean
}

export interface CustomRackDimensions {
  headerH: number
  headerW: number
  headerD: number
  footerH: number
  footerW: number
  footerD: number
  bodyH: number
  innerWidth: number
  innerDepth: number
  innerHeight: number
  totalHeight: number
}

export function resolveSectionSize(
  section: CustomRackSection,
  outerWidth: number,
  outerDepth: number,
  kind: 'header' | 'footer',
): { width: number; depth: number } {
  const width =
    section.width > 0
      ? section.width
      : outerWidth
  const depth =
    section.depth > 0
      ? section.depth
      : kind === 'header'
        ? outerDepth * 0.28 + section.protrusion
        : outerDepth + section.protrusion
  return { width, depth }
}

/** Treat width/depth that match outer or inner envelope as 0 (auto full span). */
export function normalizeSectionSpans(cfg: CustomRackConfig): CustomRackConfig {
  const innerW = Math.max(0.1, cfg.outerWidth - cfg.wallThickness * 2)
  const innerD = Math.max(0.1, cfg.outerDepth - cfg.wallThickness * 2)
  const normSpan = (value: number, outer: number, inner: number) => {
    if (value <= 0) return 0
    if (Math.abs(value - outer) < 0.05) return 0
    if (Math.abs(value - inner) < 0.05) return 0
    return value
  }
  const norm = (section: CustomRackSection): CustomRackSection => ({
    ...section,
    width: normSpan(section.width, cfg.outerWidth, innerW),
    depth: normSpan(section.depth, cfg.outerDepth, innerD),
  })
  return { ...cfg, header: norm(cfg.header), footer: norm(cfg.footer) }
}

function scaleSection(section: CustomRackSection, factor: number): CustomRackSection {
  return {
    ...section,
    height: section.height * factor,
    width: section.width > 0 ? section.width * factor : 0,
    depth: section.depth > 0 ? section.depth * factor : 0,
    protrusion: section.protrusion * factor,
  }
}

/** Uniformly scale all dimensions (used for warehouse-scaled presets). */
export function scaleCustomRackConfig(cfg: CustomRackConfig, factor: number): CustomRackConfig {
  return {
    ...cfg,
    outerWidth: cfg.outerWidth * factor,
    outerDepth: cfg.outerDepth * factor,
    outerHeight: cfg.outerHeight * factor,
    wallThickness: cfg.wallThickness * factor,
    header: scaleSection(cfg.header, factor),
    footer: scaleSection(cfg.footer, factor),
    shelfThickness: cfg.shelfThickness * factor,
  }
}

/** Stretch a rack to the retail interior wall height (tall wall fixtures). */
export function fitCustomRackToRetailWall(cfg: CustomRackConfig): CustomRackConfig {
  const targetH = RETAIL_FIXTURE_HEIGHT
  if (cfg.outerHeight <= 0) return cfg
  return scaleCustomRackConfig(cfg, targetH / cfg.outerHeight)
}

function retailScaled(cfg: CustomRackConfig): CustomRackConfig {
  return scaleCustomRackConfig(cfg, WAREHOUSE_SCALE)
}


export function computeCustomRackDimensions(cfg: CustomRackConfig): CustomRackDimensions {
  const headerH = cfg.header.enabled ? cfg.header.height : 0
  const footerH = cfg.footer.enabled ? cfg.footer.height : 0
  const headerSize = resolveSectionSize(cfg.header, cfg.outerWidth, cfg.outerDepth, 'header')
  const footerSize = resolveSectionSize(cfg.footer, cfg.outerWidth, cfg.outerDepth, 'footer')
  const bodyH = Math.max(0.2, cfg.outerHeight - headerH - footerH)
  const wt = cfg.wallThickness
  const innerWidth = Math.max(0.1, cfg.outerWidth - wt * 2)
  const innerDepth = Math.max(0.1, cfg.outerDepth - wt * 2)
  const innerHeight = Math.max(0.1, bodyH - wt)
  return {
    headerH,
    headerW: headerSize.width,
    headerD: headerSize.depth,
    footerH,
    footerW: footerSize.width,
    footerD: footerSize.depth,
    bodyH,
    innerWidth,
    innerDepth,
    innerHeight,
    totalHeight: cfg.outerHeight,
  }
}

/** End-cap style — branded header/footer, open front (Almarai-style). */
export function createEndCapPreset(): CustomRackConfig {
  return retailScaled({
    preset: 'END_CAP',
    outerWidth: 0.9,
    outerDepth: 0.5,
    outerHeight: 1.8,
    wallThickness: 0.06,
    header: {
      enabled: true,
      height: 0.45,
      width: 0.94,
      depth: 0.28,
      protrusion: 0.06,
      color: '#27ae60',
      emissive: '#1e8449',
    },
    footer: {
      enabled: true,
      height: 0.2,
      width: 0.9,
      depth: 0.55,
      protrusion: 0.05,
      color: '#27ae60',
      emissive: '#1e8449',
    },
    walls: { back: true, left: true, right: true, frontGlass: false },
    shelfCount: 0,
    shelfThickness: 0.03,
    accentColor: '#2C5282',
    isDoubleSided: false,
  })
}

/** Refrigerated cabinet — glass front, blue header (Almarai-style). */
export function createRefrigeratedPreset(): CustomRackConfig {
  return fitCustomRackToRetailWall(retailScaled({
    preset: 'REFRIGERATED',
    outerWidth: 1.8,
    outerDepth: 0.72,
    outerHeight: 2.3,
    wallThickness: 0.08,
    header: {
      enabled: true,
      height: 0.35,
      width: 0,
      depth: 0,
      protrusion: 0.04,
      color: '#2C5282',
      emissive: '#1A365D',
    },
    footer: {
      enabled: true,
      height: 0.18,
      width: 0,
      depth: 0,
      protrusion: 0.02,
      color: '#2C5282',
      emissive: '#1A365D',
    },
    walls: { back: true, left: true, right: true, frontGlass: true },
    shelfCount: 0,
    shelfThickness: 0.025,
    accentColor: '#2C5282',
    isDoubleSided: false,
  }))
}

export function createBlankCustomRack(): CustomRackConfig {
  return retailScaled({
    preset: 'CUSTOM',
    // Standard pallet / grocery bay start (metres)
    outerWidth: 2.7,
    outerDepth: 1.1,
    outerHeight: 2.0,
    wallThickness: 0.06,
    header: {
      enabled: false,
      height: 0.35,
      width: 0,
      depth: 0,
      protrusion: 0,
      color: '#2C5282',
      emissive: '#1A365D',
    },
    footer: {
      enabled: true,
      height: 0.12,
      width: 0,
      depth: 0,
      protrusion: 0,
      color: '#ecf0f1',
    },
    walls: { back: true, left: true, right: true, frontGlass: false },
    shelfCount: 0,
    shelfThickness: 0.03,
    accentColor: '#2C5282',
    isDoubleSided: false,
  })
}

export function cloneCustomRackConfig(cfg: CustomRackConfig): CustomRackConfig {
  return JSON.parse(JSON.stringify(cfg)) as CustomRackConfig
}
