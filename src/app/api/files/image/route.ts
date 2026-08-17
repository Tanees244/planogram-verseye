import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  resolvePresignedDownloadUrl,
  storageKeyFromSignedUrl,
} from '@/app/api/utils/presignedDownload'

/**
 * Staging often signs https://aisleris-staging…:32004 while images should be
 * fetched from a reachable MinIO IP.
 *
 * OBJECT_STORAGE_IMAGE_ORIGIN=http://163.61.91.156:32004
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
  if (
    process.env.OBJECT_STORAGE_FORCE_HTTP === '1' ||
    process.env.OBJECT_STORAGE_FORCE_HTTP === 'true'
  ) {
    try {
      const u = new URL(out)
      if (u.protocol === 'https:') {
        u.protocol = 'http:'
        out = u.toString()
      }
    } catch {
      /* ignore */
    }
  }
  return out
}

function asHttpUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    u.protocol = 'http:'
    return u.toString()
  } catch {
    return null
  }
}

async function fetchBinary(url: string): Promise<Response> {
  const target = rewriteImageStorageUrl(url)
  const host = (() => {
    try {
      return new URL(target).host
    } catch {
      return ''
    }
  })()

  const get = (u: string) =>
    fetch(u, { cache: 'no-store', redirect: 'follow', credentials: 'omit' })

  let upstream: globalThis.Response
  try {
    upstream = await get(target)
  } catch (e) {
    const httpFallback = asHttpUrl(target)
    if (httpFallback) {
      try {
        upstream = await get(httpFallback)
      } catch {
        const msg = e instanceof Error ? e.message : 'fetch failed'
        console.error('[files/image] storage fetch failed', { host, msg })
        return new NextResponse(`Fetch failed from storage${host ? ` (${host})` : ''}`, {
          status: 502,
        })
      }
    } else {
      const msg = e instanceof Error ? e.message : 'fetch failed'
      console.error('[files/image] storage fetch failed', { host, msg })
      return new NextResponse(`Fetch failed from storage${host ? ` (${host})` : ''}`, {
        status: 502,
      })
    }
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

async function fetchViaPresignedKey(req: NextRequest, key: string): Promise<Response> {
  const resolved = await resolvePresignedDownloadUrl(req, key, 'files/image')
  if (!resolved.ok) {
    return new NextResponse(resolved.message, { status: resolved.status })
  }
  return fetchBinary(resolved.url)
}

/**
 * Same-origin image proxy for UI + WebGL textures.
 * Prefer `key` — resolves via presigned-download API (same as GLB models).
 * GET /api/files/image?key=<objectStorageKey>
 * GET /api/files/image?url=<https://...>  (infers key when possible)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const keyParam = searchParams.get('key')

  if (keyParam?.trim()) {
    try {
      return await fetchViaPresignedKey(req, keyParam.trim())
    } catch {
      return new NextResponse('Image proxy failed', { status: 502 })
    }
  }

  if (url && /^https?:\/\//i.test(url)) {
    const inferredKey = storageKeyFromSignedUrl(url)
    if (inferredKey) {
      try {
        return await fetchViaPresignedKey(req, inferredKey)
      } catch {
        /* fall through to direct fetch */
      }
    }
    try {
      return await fetchBinary(url)
    } catch {
      return new NextResponse('Fetch failed', { status: 502 })
    }
  }

  return new NextResponse('Missing or invalid url/key', { status: 400 })
}
