import type { Rack, RackSide, Row } from '@/store/planogramStore'
import type { RackSurfacePosm, ZoneFootprint, ZoneVolume } from '@/types/rackBlueprint'
import { resolveRackInner, resolveRackOuter } from '@/utils/rackBlueprintMapper'
import { resolveUsableRowStackHeight, sumRowHeights } from '@/utils/rowStack'
import { formatCm, formatCmPair, formatCmTriple } from '@/utils/lengthUnits'

export function normalizeRackPosm(raw: unknown): RackSurfacePosm | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const id = d.id ?? d.posmItemId
  if (typeof id !== 'string' || !id.trim()) return null
  const posmType =
    (typeof d.posmType === 'string' && d.posmType) ||
    (typeof d.type === 'string' && d.type) ||
    'ShelfTalker'

  const imageUrls = Array.isArray(d.imageUrls)
    ? d.imageUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : []
  const imageUrl =
    (typeof d.imageUrl === 'string' && d.imageUrl) ||
    (typeof d.thumbnailUrl === 'string' && d.thumbnailUrl) ||
    imageUrls[0] ||
    null

  return {
    id: id.trim(),
    name:
      (typeof d.name === 'string' && d.name) ||
      (typeof d.programName === 'string' && d.programName) ||
      'POSM item',
    posmType,
    imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : null,
    imageStorageKey:
      (typeof d.imageStorageKey === 'string' && d.imageStorageKey) ||
      (typeof d.imageObjectKey === 'string' && d.imageObjectKey) ||
      (typeof d.storageKey === 'string' && d.storageKey) ||
      (typeof d.objectKey === 'string' && d.objectKey) ||
      null,
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
      message: `header.height + footer.height (${formatCm(headerH + footerH)}) exceeds rack height (${formatCm(outer.height)})`,
    })
  }

  const innerD = zones.inner.depth ?? 0
  const outerD = zones.outer.depth ?? 0
  const sideDepth = side.depth ?? outer.depth
  if (side.inner?.depth != null && side.outer?.depth != null && innerD + outerD > sideDepth + 0.001) {
    issues.push({
      message: `inner.depth + outer.depth (${formatCm(innerD + outerD)}) exceeds side depth (${formatCm(sideDepth)})`,
    })
  }

  const rowStack = sumRowHeights(side.rows)
  const usableH = resolveUsableRowStackHeight(rack)
  if (rowStack > usableH + 0.001) {
    issues.push({
      message: `Σ row heights (${formatCm(rowStack)}) exceeds usable stack (${formatCm(usableH)})`,
    })
  }

  for (const row of side.rows) {
    const span = row.width ?? row.span ?? inner.width
    if (span > inner.width + 0.001) {
      issues.push({
        message: `Row span ${formatCm(span)} > inner.width ${formatCm(inner.width)}`,
      })
    }
    const binSum = row.bins.reduce((s, b) => s + (Number(b.width) || 0), 0)
    if (binSum > span + 0.001) {
      issues.push({
        message: `Σ bin.width ${formatCm(binSum)} > row span ${formatCm(span)}`,
      })
    }
  }

  return issues
}

export function formatZoneFootprint(z: ZoneFootprint | null | undefined): string {
  if (!z?.width && !z?.depth) return '—'
  return formatCmPair(z.width, z.depth)
}

export function formatZoneVolume(z: ZoneVolume | null | undefined): string {
  if (!z?.width && !z?.depth && !z?.height) return '—'
  return formatCmTriple(z.width, z.depth, z.height)
}
