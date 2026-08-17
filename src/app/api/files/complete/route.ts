import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { proxyLayout } from '@/app/api/utils/layoutProxy'

/** POST /api/files/complete — verify a pre-signed PUT before the key is usable. */
export async function POST(req: NextRequest) {
  let body: { objectKey?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    )
  }

  const objectKey = typeof body.objectKey === 'string' ? body.objectKey.trim() : ''
  if (!objectKey) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'objectKey is required', statusCode: 400 },
      { status: 400 },
    )
  }

  return proxyLayout(req, '/api/v1/files/complete', {
    method: 'POST',
    body: { objectKey },
  })
}
