import { NextResponse } from 'next/server'
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

/** PUT /api/layout/shelves/{shelfId} → update shelf (name, etc.) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ shelfId: string }> },
) {
  const { shelfId } = await params
  if (!shelfId) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'shelfId is required', statusCode: 400 },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    )
  }

  const payload =
    body && typeof body === 'object' && !Array.isArray(body)
      ? { ...(body as Record<string, unknown>), shelfId }
      : { shelfId }

  return proxyLayout(req, `/api/v1/layout/shelves/${encodeURIComponent(shelfId)}`, {
    method: 'PUT',
    body: payload,
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
