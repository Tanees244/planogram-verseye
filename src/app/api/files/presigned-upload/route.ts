import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { proxyLayout } from '@/app/api/utils/layoutProxy'

const PURPOSES = new Set(['GenericFile', 'ShelfCapture', 'PlanogramImage'])

/** Request a server-generated pre-signed upload URL. Do not send bucket/objectKey. */
export async function POST(req: NextRequest) {
  let body: {
    fileName?: string
    contentType?: string
    purpose?: string
    expiresInMinutes?: number | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    )
  }

  if (!body.fileName || !body.contentType) {
    return NextResponse.json(
      {
        isRequestSuccess: false,
        message: 'fileName and contentType are required',
        statusCode: 400,
      },
      { status: 400 },
    )
  }

  const purpose =
    typeof body.purpose === 'string' && PURPOSES.has(body.purpose)
      ? body.purpose
      : 'GenericFile'

  return proxyLayout(req, '/api/v1/files/presigned-upload', {
    method: 'POST',
    body: {
      fileName: body.fileName,
      contentType: body.contentType,
      purpose,
      ...(typeof body.expiresInMinutes === 'number'
        ? { expiresInMinutes: body.expiresInMinutes }
        : {}),
    },
  })
}
