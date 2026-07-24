import type {
  ShelfFacingUtilization,
  ShelfRowUtilization,
} from '@/types/shelfUtilization'
import { getPlanogramTokenFromCookie } from '@verseye/utils'

export type ApplyScoredRankingSku = {
  skuId: string
  requestedFacings: number
  appliedFacings: number
}

export type ApplyScoredRankingResult = {
  storeId: string
  shelfId: string
  rackId: string
  rackSideId: string
  planogramName: string
  rackCode: string
  fixtureType: string | null
  appliedSkuCount: number
  totalAppliedFacings: number
  shelfUtilization: ShelfFacingUtilization
  rowUtilizations: ShelfRowUtilization[]
  appliedSkus: ApplyScoredRankingSku[]
  warnings: string[]
  layoutEditorPath: string
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

/** Apply AI scored ranking to a shelf/rack side; always refetch structure after success. */
export async function applyScoredPlanogramRanking(
  body: Record<string, unknown>,
): Promise<{ success: boolean; data?: ApplyScoredRankingResult; message?: string }> {
  try {
    const res = await fetch('/api/ai-planogram/apply-scored-ranking', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false || json?.success === false) {
      return {
        success: false,
        message: json?.message || `Apply scored ranking failed (${res.status})`,
      }
    }
    return {
      success: true,
      data: (json?.data ?? json) as ApplyScoredRankingResult,
      message: json?.message,
    }
  } catch {
    return { success: false, message: 'Network error applying scored ranking' }
  }
}
