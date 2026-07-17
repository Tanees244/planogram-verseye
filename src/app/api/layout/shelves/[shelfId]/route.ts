import type { NextRequest } from 'next/server'
import { proxyLayout } from '@/app/api/utils/layoutProxy'

/** GET /api/layout/shelves/{shelfId} → shelf/planogram detail */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shelfId: string }> },
) {
  const { shelfId } = await params
  return proxyLayout(req, `/api/v1/layout/shelves/${encodeURIComponent(shelfId)}`, {
    method: 'GET',
  })
}

/** DELETE /api/layout/shelves/{shelfId} → remove shelf/planogram */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shelfId: string }> },
) {
  const { shelfId } = await params
  return proxyLayout(req, `/api/v1/layout/shelves/${encodeURIComponent(shelfId)}`, {
    method: 'DELETE',
  })
}
