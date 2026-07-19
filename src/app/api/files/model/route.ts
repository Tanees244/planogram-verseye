import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from '@/app/api/utils/getToken'

const API_BASE_URL = process.env.API_BASE_URL

async function fetchBinary(url: string): Promise<Response> {
  let upstream: globalThis.Response
  try {
    upstream = await fetch(url, { cache: 'no-store' })
  } catch {
    // Transient network/TLS hiccups are common against staging MinIO — retry once.
    await new Promise((r) => setTimeout(r, 300))
    upstream = await fetch(url, { cache: 'no-store' })
  }
  if (!upstream.ok) {
    return new NextResponse('Upstream error', { status: upstream.status })
  }
  const contentType =
    upstream.headers.get('content-type') ??
    (url.toLowerCase().includes('.glb') ? 'model/gltf-binary' : 'application/octet-stream')
  const body = await upstream.arrayBuffer()
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

/**
 * Same-origin proxy for GLB/GLTF assets (catalog 3D models).
 * GET /api/files/model?url=<https://...>
 * GET /api/files/model?key=<objectStorageKey>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const key = searchParams.get('key')

  // Direct URL first; presigned URLs expire (24h), so fall through to a
  // fresh presign via `key` instead of failing when both are provided.
  if (url && /^https?:\/\//i.test(url)) {
    try {
      const res = await fetchBinary(url)
      if (res.status < 400) return res
      if (!key || !API_BASE_URL) return res
    } catch {
      if (!key || !API_BASE_URL) {
        return new NextResponse('Fetch failed', { status: 502 })
      }
    }
  }

  if (key && API_BASE_URL) {
    try {
      const token = await getToken(req)
      if (!token) {
        return new NextResponse('Unauthorized', { status: 401 })
      }

      const presignRes = await fetch(`${API_BASE_URL}/api/v1/files/presigned-download`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ objectKey: key }),
        cache: 'no-store',
      })

      const presignText = await presignRes.text()
      let presignJson: Record<string, unknown> = {}
      try {
        presignJson = presignText ? JSON.parse(presignText) : {}
      } catch {
        /* ignore */
      }

      const inner =
        presignJson.data && typeof presignJson.data === 'object'
          ? (presignJson.data as Record<string, unknown>)
          : presignJson

      const downloadUrl =
        (typeof inner.url === 'string' && inner.url) ||
        (typeof inner.presignedUrl === 'string' && inner.presignedUrl) ||
        (typeof inner.downloadUrl === 'string' && inner.downloadUrl)

      if (!presignRes.ok || !downloadUrl) {
        return new NextResponse('Could not resolve model download URL', { status: presignRes.status || 502 })
      }

      return await fetchBinary(downloadUrl)
    } catch {
      return new NextResponse('Model proxy failed', { status: 502 })
    }
  }

  return new NextResponse('Missing or invalid url/key', { status: 400 })
}
