import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from '@/app/api/utils/getToken'

const API_BASE_URL = process.env.API_BASE_URL

/**
 * Staging often signs https://aisleris-staging…:32004 while images should be
 * fetched from a reachable MinIO IP. Keep path + query (signature) intact.
 *
 * IMAGE_STORAGE_PUBLIC_ORIGIN=http://163.61.91.156:32004
 */
function rewriteImageStorageUrl(url: string): string {
  const publicOrigin =
    process.env.IMAGE_STORAGE_PUBLIC_ORIGIN?.trim() ||
    process.env.OBJECT_STORAGE_IMAGE_ORIGIN?.trim()
  let out = url
  if (publicOrigin) {
    try {
      const target = new URL(publicOrigin)
      const u = new URL(out)
      u.protocol = target.protocol
      u.host = target.host
      out = u.toString()
    } catch {
      /* ignore bad env */
    }
  }
  // MinIO on :32004 is plain HTTP; signed https:// links fail TLS in Node.
  try {
    const u = new URL(out)
    if (u.protocol === 'https:') {
      u.protocol = 'http:'
      out = u.toString()
    }
  } catch {
    /* ignore */
  }
  return out
}

function pickDownloadUrl(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.url,
    payload.presignedUrl,
    payload.downloadUrl,
    payload.signedUrl,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) return c.trim()
  }
  return null
}

async function fetchBinary(url: string): Promise<Response> {
  const target = rewriteImageStorageUrl(url)
  let upstream: globalThis.Response
  try {
    upstream = await fetch(target, { cache: 'no-store', redirect: 'follow', credentials: 'omit' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed'
    const host = (() => {
      try {
        return new URL(target).host
      } catch {
        return ''
      }
    })()
    console.error('[files/image] storage fetch failed', { host, msg })
    return new NextResponse(`Fetch failed from storage${host ? ` (${host})` : ''}`, {
      status: 502,
    })
  }
  if (!upstream.ok) {
    console.error('[files/image] upstream', upstream.status, target.slice(0, 120))
    return new NextResponse('Upstream error', { status: upstream.status })
  }
  const contentType = upstream.headers.get('content-type') ?? 'image/png'
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
 * Same-origin image proxy for UI + WebGL textures.
 * GET /api/files/image?url=<https://...>
 * GET /api/files/image?key=<objectStorageKey>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const key = searchParams.get('key')

  if (url && /^https?:\/\//i.test(url)) {
    try {
      return await fetchBinary(url)
    } catch {
      return new NextResponse('Fetch failed', { status: 502 })
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
        (presignJson.data && typeof presignJson.data === 'object'
          ? (presignJson.data as Record<string, unknown>)
          : null) ??
        (presignJson.result && typeof presignJson.result === 'object'
          ? (presignJson.result as Record<string, unknown>)
          : null) ??
        presignJson

      const downloadUrl =
        (typeof presignJson.data === 'string' && /^https?:\/\//i.test(presignJson.data)
          ? presignJson.data
          : null) || pickDownloadUrl(inner)

      if (!presignRes.ok || !downloadUrl) {
        return new NextResponse('Could not resolve image download URL', {
          status: presignRes.status || 502,
        })
      }

      return await fetchBinary(downloadUrl)
    } catch {
      return new NextResponse('Image proxy failed', { status: 502 })
    }
  }

  return new NextResponse('Missing or invalid url/key', { status: 400 })
}
