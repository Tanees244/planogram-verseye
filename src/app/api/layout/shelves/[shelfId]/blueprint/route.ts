import type { NextRequest } from 'next/server'
import { proxyLayout } from '@/app/api/utils/layoutProxy'

/** GET /api/layout/shelves/{shelfId}/blueprint → shelf-face planogram blueprint */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shelfId: string }> },
) {
  const { shelfId } = await params
  return proxyLayout(
    req,
    `/api/v1/layout/shelves/${encodeURIComponent(shelfId)}/blueprint`,
    { method: 'GET' },
  )
}
