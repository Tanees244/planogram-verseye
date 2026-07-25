import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from '@/app/api/utils/getToken'

const API_BASE_URL = process.env.API_BASE_URL

/**
 * PUT /api/layout/shelves/{shelfId}/planogram/ideal-image
 * Proxies multipart ideal-image upload to layout backend.
 */
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

  try {
    if (!API_BASE_URL) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Server configuration error', statusCode: 500 },
        { status: 500 },
      )
    }

    const token = await getToken(req)
    if (!token) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 },
        { status: 401 },
      )
    }

    const incoming = await req.formData()
    const forward = new FormData()
    for (const [key, value] of incoming.entries()) {
      forward.append(key, value as Blob | string)
    }

    // Do NOT set Content-Type manually; fetch sets the multipart boundary.
    const res = await fetch(
      `${API_BASE_URL}/api/v1/layout/shelves/${encodeURIComponent(shelfId)}/planogram/ideal-image`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: forward,
        cache: 'no-store',
      },
    )

    const text = await res.text()
    let data: unknown
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!res.ok) {
      console.error('[ideal-image] Backend error', res.status, text)
      const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
      const message =
        (obj && (obj.message || obj.title)) ||
        (typeof data === 'string' && data) ||
        `Backend returned ${res.status}`
      return NextResponse.json(
        { isRequestSuccess: false, message, statusCode: res.status, data: null },
        { status: res.status },
      )
    }

    const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null
    const success = obj ? Boolean(obj.isRequestSuccess ?? obj.success ?? true) : true
    const inner = obj ? (obj.data ?? obj) : data

    return NextResponse.json({ isRequestSuccess: success, data: inner }, { status: res.status })
  } catch (error) {
    console.error('[ideal-image] SSR error:', error)
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
      { status: 500 },
    )
  }
}
