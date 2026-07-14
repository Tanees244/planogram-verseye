import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { proxyLayout } from '@/app/api/utils/layoutProxy'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ rackId: string }> },
) {
  const { rackId } = await context.params
  if (!rackId || !UUID_RE.test(rackId)) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rackId must be a valid UUID', statusCode: 400 },
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

  return proxyLayout(req, `/api/v1/layout/racks/${encodeURIComponent(rackId)}/reflow`, {
    method: 'POST',
    body,
  })
}
