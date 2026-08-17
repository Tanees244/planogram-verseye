import type { Rack } from '@/store/planogramStore'
import { resolveProductFacingId } from '@/utils/storeLayoutLoader'
import {
  binFacingOccupied,
  rowSpanMeters,
  validateRackFaceFill,
  type FaceFillIssue,
} from '@/utils/faceFill'
import {
  findRowContextForBin,
  findRowContextForRowId,
  isEyeLevelRow,
  isHeroSkuId,
} from '@/utils/heroSku'

export type ComplianceSeverity = 'error' | 'warning' | 'info' | 'pass'

export type ComplianceItem = {
  id: string
  severity: ComplianceSeverity
  category: 'face_fill' | 'hero' | 'sos' | 'posm' | 'structure'
  title: string
  detail?: string
  rowId?: string
  binId?: string
}

export type ComplianceReport = {
  items: ComplianceItem[]
  errorCount: number
  warningCount: number
  passCount: number
  ready: boolean
}

function pushFaceFillItems(items: ComplianceItem[], issues: FaceFillIssue[]) {
  for (const issue of issues) {
    const severity: ComplianceSeverity =
      issue.severity === 'error' ? 'error' : 'warning'
    items.push({
      id: `face-${issue.code}-${issue.rowId ?? ''}-${issue.binId ?? ''}-${items.length}`,
      severity,
      category: 'face_fill',
      title: issue.message,
      rowId: issue.rowId,
      binId: issue.binId,
    })
  }
}

function checkHeroPlacement(rack: Rack, items: ComplianceItem[]) {
  for (const side of rack.sides) {
    for (const row of side.rows) {
      for (const bin of row.bins) {
        for (const product of bin.products) {
          const skuId = resolveProductFacingId(product.id)
          const hero =
            product.isHero === true ||
            isHeroSkuId(skuId)
          if (!hero) continue
          const ctx = findRowContextForBin([rack], bin.id)
          if (!ctx) continue
          if (isEyeLevelRow(ctx.row, ctx.sideRows)) {
            items.push({
              id: `hero-pass-${bin.id}-${skuId}`,
              severity: 'pass',
              category: 'hero',
              title: `Hero SKU "${product.name}" is on an eye-level shelf`,
              rowId: row.id,
              binId: bin.id,
            })
          } else {
            items.push({
              id: `hero-fail-${bin.id}-${skuId}`,
              severity: 'error',
              category: 'hero',
              title: `Hero SKU "${product.name}" is not on an eye-level shelf`,
              detail:
                'Move hero products to shelves between ≈120–160 cm from the floor (or the middle third on short racks).',
              rowId: row.id,
              binId: bin.id,
            })
          }
        }
      }
    }
  }
}

function checkSosTargets(rack: Rack, items: ComplianceItem[]) {
  for (const side of rack.sides) {
    for (const row of side.rows) {
      const span = rowSpanMeters(row, rack)
      if (!(span && span > 0)) continue
      const skuMap = new Map<
        string,
        { name: string; occupiedM: number; target?: number | null }
      >()
      for (const bin of row.bins) {
        for (const product of bin.products) {
          const skuId = resolveProductFacingId(product.id)
          const w = Number(product.width)
          const q = Math.max(1, Math.floor(Number(product.quantity) || 1))
          if (!(w > 0)) continue
          const target =
            typeof product.sosPercentTarget === 'number'
              ? product.sosPercentTarget
              : undefined
          const prev = skuMap.get(skuId)
          skuMap.set(skuId, {
            name: product.name,
            occupiedM: (prev?.occupiedM ?? 0) + w * q,
            target: target ?? prev?.target,
          })
        }
      }
      for (const [skuId, data] of skuMap) {
        if (data.target == null || !Number.isFinite(data.target)) continue
        const actualPct = (data.occupiedM / span) * 100
        const delta = Math.abs(actualPct - data.target)
        if (delta <= 2) {
          items.push({
            id: `sos-pass-${row.id}-${skuId}`,
            severity: 'pass',
            category: 'sos',
            title: `"${data.name}" SOS ${actualPct.toFixed(1)}% (target ${data.target}%)`,
            rowId: row.id,
          })
        } else if (delta <= 5) {
          items.push({
            id: `sos-warn-${row.id}-${skuId}`,
            severity: 'warning',
            category: 'sos',
            title: `"${data.name}" SOS ${actualPct.toFixed(1)}% vs target ${data.target}%`,
            detail: 'Within 5% — consider adjusting facings before publish.',
            rowId: row.id,
          })
        } else {
          items.push({
            id: `sos-fail-${row.id}-${skuId}`,
            severity: 'warning',
            category: 'sos',
            title: `"${data.name}" SOS ${actualPct.toFixed(1)}% vs target ${data.target}%`,
            detail: 'Share of shelf differs from target by more than 5%.',
            rowId: row.id,
          })
        }
      }
    }
  }
}

function checkPosmCoverage(rack: Rack, items: ComplianceItem[]) {
  for (const side of rack.sides) {
    for (const row of side.rows) {
      const hasProducts = row.bins.some((b) => b.products.length > 0)
      if (!hasProducts) continue
      const anyBinTag = row.bins.some((b) => b.itemTagPosm || b.itemTagPosmItemId)
      const hasRowTalker = Boolean(row.dividerPosm || row.dividerPosmItemId)
      if (anyBinTag || hasRowTalker) {
        items.push({
          id: `posm-pass-${row.id}`,
          severity: 'pass',
          category: 'posm',
          title: 'Shelf talker / POSM assigned on this row',
          rowId: row.id,
        })
      } else {
        items.push({
          id: `posm-warn-${row.id}`,
          severity: 'warning',
          category: 'posm',
          title: 'Row with products has no shelf talker (POSM)',
          detail: 'Drag a POSM item onto the shelf front lip in the editor.',
          rowId: row.id,
        })
      }
    }
  }
}

function checkStructure(rack: Rack, items: ComplianceItem[]) {
  let rowIndex = 0
  for (const side of rack.sides) {
    for (const row of side.rows) {
      rowIndex += 1
      const hasProducts = row.bins.some((b) => b.products.length > 0)
      const span = rowSpanMeters(row, rack)
      if (!hasProducts) {
        items.push({
          id: `empty-row-${row.id}`,
          severity: 'warning',
          category: 'structure',
          title: `Shelf ${rowIndex} is empty`,
          detail: 'Empty shelves are allowed but may fail store execution checks.',
          rowId: row.id,
        })
        continue
      }
      if (span && span > 0) {
        let occupied = 0
        for (const bin of row.bins) {
          occupied += binFacingOccupied(bin.products)
        }
        if (occupied > 0 && occupied / span < 0.05) {
          items.push({
            id: `sparse-row-${row.id}`,
            severity: 'info',
            category: 'structure',
            title: `Shelf ${rowIndex} uses less than 5% of available width`,
            rowId: row.id,
          })
        }
      }
    }
  }

  // Rows that block hero placement proactively
  for (const side of rack.sides) {
    for (const row of side.rows) {
      const ctx = findRowContextForRowId([rack], row.id)
      if (!ctx) continue
      if (!isEyeLevelRow(ctx.row, ctx.sideRows)) continue
      items.push({
        id: `eye-row-${row.id}`,
        severity: 'info',
        category: 'structure',
        title: 'Eye-level shelf available for hero SKUs',
        rowId: row.id,
      })
    }
  }
}

export function evaluateRackCompliance(rack: Rack): ComplianceReport {
  const items: ComplianceItem[] = []

  const faceIssues = validateRackFaceFill(rack)
  pushFaceFillItems(items, faceIssues)
  checkHeroPlacement(rack, items)
  checkSosTargets(rack, items)
  checkPosmCoverage(rack, items)
  checkStructure(rack, items)

  if (items.length === 0) {
    items.push({
      id: 'all-clear',
      severity: 'pass',
      category: 'structure',
      title: 'No compliance issues found',
    })
  }

  const errorCount = items.filter((i) => i.severity === 'error').length
  const warningCount = items.filter((i) => i.severity === 'warning').length
  const passCount = items.filter((i) => i.severity === 'pass').length

  return {
    items,
    errorCount,
    warningCount,
    passCount,
    ready: errorCount === 0,
  }
}
