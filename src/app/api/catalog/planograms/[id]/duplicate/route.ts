import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Legacy catalog duplicate — retired. */
export async function POST(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return NextResponse.json(
    {
      isRequestSuccess: false,
      message: 'Catalog planograms API is retired. Use /api/layout/shelves instead.',
      statusCode: 410,
    },
    { status: 410 },
  )
}
