import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Legacy catalog planograms API — retired in favor of /api/layout/shelves. */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      isRequestSuccess: false,
      message: 'Catalog planograms API is retired. Use /api/layout/shelves instead.',
      statusCode: 410,
    },
    { status: 410 },
  )
}

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      isRequestSuccess: false,
      message: 'Catalog planograms API is retired. Use /api/layout/shelves instead.',
      statusCode: 410,
    },
    { status: 410 },
  )
}
