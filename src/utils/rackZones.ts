import type { Rack, RackSide, Row } from '@/store/planogramStore'
import type { RackSurfacePosm, ZoneFootprint, ZoneVolume } from '@/types/rackBlueprint'
import { resolveRackInner, resolveRackOuter } from '@/utils/rackBlueprintMapper'
import { resolveUsableRowStackHeight, sumRowHeights } from '@/utils/rowStack'

export function normalizeRackPosm(raw: unknown): RackSurfacePosm | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const id = d.id ?? d.posmItemId
  if (typeof id !== 'string' || !id.trim()) return null
  const posmType =
    (typeof d.posmType === 'string' && d.posmType) ||
    (typeof d.type === 'string' && d.type) ||
    'ShelfTalker'
  return {
    id: id.trim(),
    name:
      (typeof d.name === 'string' && d.name) ||
      (typeof d.programName === 'string' && d.programName) ||
      'POSM item',
    posmType,
  }
}

export function normalizeZoneFootprint(raw: unknown): ZoneFootprint | null {
  if (!raw || typeof raw !== 'object') return null
  const z = raw as Record<string, unknown>
  return {
    width: z.width != null ? Number(z.width) : null,
    depth: z.depth != null ? Number(z.depth) : null,
  }
}

export function normalizeZoneVolume(raw: unknown): ZoneVolume | null {
  if (!raw || typeof raw !== 'object') return null
  const z = raw as Record<string, unknown>
  return {
    width: z.width != null ? Number(z.width) : null,
    depth: z.depth != null ? Number(z.depth) : null,
    height: z.height != null ? Number(z.height) : null,
  }
}

/** Effective zone dims with rack/side fallbacks (meters). */
export function resolveSideZoneDefaults(
  side: RackSide,
  rack: Rack,
): {
  inner: ZoneFootprint
  outer: ZoneFootprint
  header: ZoneVolume
  footer: ZoneVolume
} {
  const outer = resolveRackOuter(rack)
  const rackW = outer.width
  const sideDepth = side.depth ?? outer.depth
  const headerH = rack.shell?.header?.enabled ? Number(rack.shell.header.height) || 0 : 0
  const footerH = rack.shell?.footer?.enabled ? Number(rack.shell.footer.height) || 0 : 0

  return {
    inner: {
      width: side.inner?.width ?? rackW,
      depth: side.inner?.depth ?? sideDepth * 0.8,
    },
    outer: {
      width: side.outer?.width ?? rackW,
      depth: side.outer?.depth ?? 0.05,
    },
    header: {
      width: side.header?.width ?? rackW,
      depth: side.header?.depth ?? sideDepth,
      height: side.header?.height ?? headerH,
    },
    footer: {
      width: side.footer?.width ?? rackW,
      depth: side.footer?.depth ?? sideDepth,
      height: side.footer?.height ?? footerH,
    },
  }
}

export interface ZoneValidationIssue {
  message: string
}

/** Mirror server rules for instant UI feedback. */
export function validateSideZones(side: RackSide, rack: Rack): ZoneValidationIssue[] {
  const issues: ZoneValidationIssue[] = []
  const outer = resolveRackOuter(rack)
  const inner = resolveRackInner(rack)
  const zones = resolveSideZoneDefaults(side, rack)

  const headerH = zones.header.height ?? 0
  const footerH = zones.footer.height ?? 0
  if (headerH + footerH > outer.height + 0.001) {
    issues.push({
      message: `header.height + footer.height (${(headerH + footerH).toFixed(2)} m) exceeds rack height (${outer.height.toFixed(2)} m)`,
    })
  }

  const innerD = zones.inner.depth ?? 0
  const outerD = zones.outer.depth ?? 0
  const sideDepth = side.depth ?? outer.depth
  if (side.inner?.depth != null && side.outer?.depth != null && innerD + outerD > sideDepth + 0.001) {
    issues.push({
      message: `inner.depth + outer.depth (${(innerD + outerD).toFixed(2)} m) exceeds side depth (${sideDepth.toFixed(2)} m)`,
    })
  }

  const rowStack = sumRowHeights(side.rows)
  const usableH = resolveUsableRowStackHeight(rack)
  if (rowStack > usableH + 0.001) {
    issues.push({
      message: `Σ row heights (${rowStack.toFixed(2)} m) exceeds usable stack (${usableH.toFixed(2)} m)`,
    })
  }

  for (const row of side.rows) {
    const span = row.width ?? row.span ?? inner.width
    if (span > inner.width + 0.001) {
      issues.push({
        message: `Row span ${span.toFixed(2)} m > inner.width ${inner.width.toFixed(2)} m`,
      })
    }
    const binSum = row.bins.reduce((s, b) => s + (Number(b.width) || 0), 0)
    if (binSum > span + 0.001) {
      issues.push({
        message: `Σ bin.width ${binSum.toFixed(2)} m > row span ${span.toFixed(2)} m`,
      })
    }
  }

  return issues
}

export function formatZoneFootprint(z: ZoneFootprint | null | undefined): string {
  if (!z?.width && !z?.depth) return '—'
  return `${(z.width ?? 0).toFixed(2)} × ${(z.depth ?? 0).toFixed(2)} m`
}

export function formatZoneVolume(z: ZoneVolume | null | undefined): string {
  if (!z?.width && !z?.depth && !z?.height) return '—'
  return `${(z.width ?? 0).toFixed(2)} × ${(z.depth ?? 0).toFixed(2)} × ${(z.height ?? 0).toFixed(2)} m`
}
