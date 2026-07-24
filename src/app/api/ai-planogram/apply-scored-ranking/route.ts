import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { proxyLayout } from '@/app/api/utils/layoutProxy'
import { normalizeShelfFacingUtilization } from '@/types/shelfUtilization'

/**
 * POST /api/ai-planogram/apply-scored-ranking
 * → POST /api/v1/layout/ai-planogram/apply-scored-ranking
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    )
  }

  return proxyLayout(req, '/api/v1/layout/ai-planogram/apply-scored-ranking', {
    method: 'POST',
    body,
    transform: (data) => {
      if (!data || typeof data !== 'object') return data
      const d = data as Record<string, unknown>
      const shelfUtilization = normalizeShelfFacingUtilization(d.shelfUtilization)
      const rowUtilizations = Array.isArray(d.rowUtilizations)
        ? d.rowUtilizations.map((row) => {
            const r = (row ?? {}) as Record<string, unknown>
            return {
              rowId: String(r.rowId ?? r.id ?? ''),
              rowNumber:
                r.rowNumber == null || r.rowNumber === ''
                  ? null
                  : Number(r.rowNumber),
              utilization:
                normalizeShelfFacingUtilization(r.utilization) ??
                ({
                  availableWidthMeters: null,
                  occupiedWidthMeters: 0,
                  remainingWidthMeters: null,
                  utilizationPercent: 0,
                  fits: false,
                  isOverCapacity: false,
                  canCalculate: false,
                  status: 'dimensions_unavailable' as const,
                }),
            }
          })
        : []
      return {
        ...d,
        ...(shelfUtilization ? { shelfUtilization } : {}),
        rowUtilizations,
      }
    },
  })
}
