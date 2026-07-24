import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from '@/app/api/utils/getToken'

const API_BASE_URL = process.env.API_BASE_URL

async function fetchBinary(url: string): Promise<Response> {
  let upstream: globalThis.Response
  try {
    upstream = await fetch(url, { cache: 'no-store' })
  } catch {
    await new Promise((r) => setTimeout(r, 400))
    try {
      upstream = await fetch(url, { cache: 'no-store' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'upstream fetch failed'
      return new NextResponse(`Fetch failed: ${msg}`, { status: 502 })
    }
  }
  if (!upstream.ok) {
    return new NextResponse(`Upstream error (${upstream.status})`, {
      status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
    })
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

async function resolvePresignedDownloadUrl(
  req: NextRequest,
  key: string,
): Promise<{ ok: true; url: string } | { ok: false; status: number; message: string }> {
  if (!API_BASE_URL) {
    return { ok: false, status: 502, message: 'API_BASE_URL is not configured' }
  }
  const token = await getToken(req)
  if (!token) {
    return { ok: false, status: 401, message: 'Unauthorized' }
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
    return {
      ok: false,
      status: presignRes.status || 502,
      message: `Could not resolve model download URL (${presignRes.status})`,
    }
  }
  return { ok: true, url: downloadUrl }
}

async function fetchViaPresignedKey(req: NextRequest, key: string): Promise<Response> {
  const resolved = await resolvePresignedDownloadUrl(req, key)
  if (!resolved.ok) {
    return new NextResponse(resolved.message, { status: resolved.status })
  }
  return fetchBinary(resolved.url)
}

/**
 * Same-origin proxy for GLB/GLTF assets (catalog 3D models).
 * Prefer `key` (fresh presign). `url` is a fallback for legacy callers.
 * GET /api/files/model?key=<objectStorageKey>
 * GET /api/files/model?url=<https://...>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const key = searchParams.get('key')

  // Key first — avoids expired / double-encoded signed URLs from the catalog.
  if (key) {
    try {
      return await fetchViaPresignedKey(req, key)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'presign failed'
      if (!(url && /^https?:\/\//i.test(url))) {
        return new NextResponse(`Model proxy failed: ${msg}`, { status: 502 })
      }
    }
  }

  if (url && /^https?:\/\//i.test(url)) {
    try {
      return await fetchBinary(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'fetch failed'
      return new NextResponse(`Fetch failed: ${msg}`, { status: 502 })
    }
  }

  return new NextResponse('Missing or invalid url/key', { status: 400 })
}

/** Cheap availability check used before useGLTF mounts — does not download the GLB. */
export async function HEAD(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const key = searchParams.get('key')

  try {
    if (key) {
      const resolved = await resolvePresignedDownloadUrl(req, key)
      if (!resolved.ok) {
        return new NextResponse(null, { status: resolved.status })
      }
      // Probe upstream without body when possible
      try {
        const probe = await fetch(resolved.url, { method: 'HEAD', cache: 'no-store' })
        if (probe.ok || probe.status === 403 || probe.status === 405) {
          // Some MinIO setups reject HEAD — treat 403/405 after successful presign as OK
          // and let GET load the real file (403 on HEAD sometimes still allows GET).
          if (probe.ok || probe.status === 405) {
            return new NextResponse(null, { status: 200 })
          }
        }
        // Fall through: try a 1-byte range GET as existence check
        const range = await fetch(resolved.url, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          cache: 'no-store',
        })
        return new NextResponse(null, {
          status: range.ok || range.status === 206 ? 200 : range.status,
        })
      } catch {
        return new NextResponse(null, { status: 502 })
      }
    }

    if (url && /^https?:\/\//i.test(url)) {
      try {
        const probe = await fetch(url, { method: 'HEAD', cache: 'no-store' })
        if (probe.ok || probe.status === 405) {
          return new NextResponse(null, { status: 200 })
        }
        const range = await fetch(url, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          cache: 'no-store',
        })
        return new NextResponse(null, {
          status: range.ok || range.status === 206 ? 200 : range.status,
        })
      } catch {
        return new NextResponse(null, { status: 502 })
      }
    }

    return new NextResponse(null, { status: 400 })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
