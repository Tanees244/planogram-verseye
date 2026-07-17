import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { proxyLayout } from '@/app/api/utils/layoutProxy'

/** GET /api/layout/shelves?storeId=&search=&page=&pageSize= → layout shelves (planogram catalog) */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('storeId')
  if (!storeId) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'storeId is required', statusCode: 400 },
      { status: 400 },
    )
  }
  const qs = new URLSearchParams()
  qs.set('storeId', storeId)
  const search = searchParams.get('search')
  if (search) qs.set('search', search)
  qs.set('page', searchParams.get('page') ?? '1')
  qs.set('pageSize', searchParams.get('pageSize') ?? '50')
  return proxyLayout(req, `/api/v1/layout/shelves?${qs.toString()}`, { method: 'GET' })
}
