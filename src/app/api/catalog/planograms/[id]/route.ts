import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const GONE = {
  isRequestSuccess: false,
  message: 'Catalog planograms API is retired. Use /api/layout/shelves instead.',
  statusCode: 410,
}

/** Legacy catalog planogram by id — retired. */
export async function GET(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return NextResponse.json(GONE, { status: 410 })
}

export async function PUT(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return NextResponse.json(GONE, { status: 410 })
}

export async function DELETE(_req: NextRequest, _ctx: { params: Promise<{ id: string }> }) {
  return NextResponse.json(GONE, { status: 410 })
}
