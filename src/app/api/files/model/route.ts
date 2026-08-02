import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from '@/app/api/utils/getToken'

const API_BASE_URL = process.env.API_BASE_URL

/** HTTP headers must be ByteString (Latin-1). Strip anything outside that. */
function asciiHeader(value: string, max = 200): string {
  return value
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function proxyErrorHeaders(message: string): HeadersInit {
  return { 'X-Model-Proxy-Error': asciiHeader(message) }
}

function pickDownloadUrl(payload: Record<string, unknown>): string | null {
  const candidates = [
    payload.url,
    payload.presignedUrl,
    payload.downloadUrl,
    payload.signedUrl,
    payload.Url,
    payload.PresignedUrl,
    payload.DownloadUrl,
    payload.SignedUrl,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) return c.trim()
  }
  return null
}

/**
 * Rewrite signed storage URLs to a reachable MinIO origin (same as images).
 *
 * OBJECT_STORAGE_MODEL_ORIGIN=http://163.61.91.156:32004
 * Optional pair: OBJECT_STORAGE_REWRITE_FROM / OBJECT_STORAGE_REWRITE_TO
 */
function maybeRewriteStorageUrl(url: string): string {
  let out = url

  const publicOrigin =
    process.env.IMAGE_STORAGE_PUBLIC_ORIGIN?.trim() ||
    process.env.OBJECT_STORAGE_IMAGE_ORIGIN?.trim()
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

  const from = process.env.OBJECT_STORAGE_REWRITE_FROM?.trim()
  const to = process.env.OBJECT_STORAGE_REWRITE_TO?.trim()
  if (from && to) {
    try {
      const src = new URL(from)
      const dst = new URL(to)
      const u = new URL(out)
      if (u.origin === src.origin) {
        u.protocol = dst.protocol
        u.host = dst.host
        out = u.toString()
      }
    } catch {
      /* ignore bad env */
    }
  }

  // Only downgrade when explicitly asked: some MinIO deployments are plain HTTP,
  // but staging serves TLS on the same port and rejects HTTP with 400. A TLS
  // failure below retries over HTTP anyway.
  const forceHttp =
    process.env.OBJECT_STORAGE_FORCE_HTTP === '1' ||
    process.env.OBJECT_STORAGE_FORCE_HTTP === 'true'
  if (forceHttp) {
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

function isTlsMismatchError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : ''
  const code =
    err instanceof Error && err.cause && typeof err.cause === 'object' && 'code' in err.cause
      ? String((err.cause as { code?: string }).code)
      : ''
  const blob = `${msg} ${cause} ${code}`
  return (
    /ERR_SSL|SSL|TLS|CERT|unable to verify|packet length/i.test(blob) ||
    code.startsWith('ERR_SSL')
  )
}

function storageHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

async function fetchBinary(url: string, rangeHeader?: string | null): Promise<Response> {
  const headers: HeadersInit = {}
  if (rangeHeader) headers.Range = rangeHeader
  let target = maybeRewriteStorageUrl(url)
  let host = storageHost(target)

  const doFetch = async (fetchUrl: string) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 12_000)
    try {
      return await fetch(fetchUrl, {
        cache: 'no-store',
        redirect: 'follow',
        credentials: 'omit',
        headers,
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  let upstream: globalThis.Response
  try {
    upstream = await doFetch(target)
  } catch (firstErr) {
    // Staging MinIO often listens on HTTP while BE signs https://… → ERR_SSL_PACKET_LENGTH_TOO_LONG
    const httpFallback = isTlsMismatchError(firstErr) ? asHttpUrl(target) : null
    if (httpFallback) {
      console.warn('[files/model] HTTPS storage TLS failed; retrying over HTTP', { host })
      try {
        upstream = await doFetch(httpFallback)
        target = httpFallback
        host = storageHost(target)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'upstream fetch failed'
        const cause =
          e instanceof Error && e.cause instanceof Error ? e.cause.message : undefined
        console.error('[files/model] storage fetch failed', { host, msg, cause })
        return new NextResponse(
          `Fetch failed from storage${host ? ` (${host})` : ''}: ${msg}`,
          {
            status: 502,
            headers: proxyErrorHeaders(cause || msg),
          },
        )
      }
    } else {
      await new Promise((r) => setTimeout(r, 400))
      try {
        upstream = await doFetch(target)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'upstream fetch failed'
        const cause =
          e instanceof Error && e.cause instanceof Error ? e.cause.message : undefined
        console.error('[files/model] storage fetch failed', { host, msg, cause })
        return new NextResponse(
          `Fetch failed from storage${host ? ` (${host})` : ''}: ${msg}`,
          {
            status: 502,
            headers: proxyErrorHeaders(cause || msg),
          },
        )
      }
    }
  }
  if (!upstream.ok && upstream.status !== 206) {
    const detail = `Upstream storage HTTP ${upstream.status}${host ? ` @ ${host}` : ''}`
    console.error('[files/model]', detail)
    return new NextResponse(detail, {
      status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
      headers: proxyErrorHeaders(detail),
    })
  }
  const contentType =
    upstream.headers.get('content-type') ??
    (target.toLowerCase().includes('.glb') ? 'model/gltf-binary' : 'application/octet-stream')
  const body = await upstream.arrayBuffer()
  const outHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
  }
  const contentRange = upstream.headers.get('content-range')
  if (contentRange) outHeaders['Content-Range'] = contentRange
  return new NextResponse(body, {
    status: upstream.status === 206 ? 206 : 200,
    headers: outHeaders,
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
    return { ok: false, status: 401, message: 'Unauthorized - no planogram token' }
  }

  let presignRes: globalThis.Response
  try {
    presignRes = await fetch(`${API_BASE_URL}/api/v1/files/presigned-download`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ objectKey: key }),
      cache: 'no-store',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'presign request failed'
    console.error('[files/model] presign request failed', msg)
    return { ok: false, status: 502, message: `Presign request failed: ${msg}` }
  }

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
    const snippet = asciiHeader(presignText, 180)
    const message = `Could not resolve model download URL (${presignRes.status})${snippet ? `: ${snippet}` : ''}`
    console.error('[files/model]', message, { key })
    return {
      ok: false,
      status: !presignRes.ok ? presignRes.status || 502 : 502,
      message,
    }
  }
  return { ok: true, url: downloadUrl }
}

async function fetchViaPresignedKey(
  req: NextRequest,
  key: string,
  rangeHeader?: string | null,
): Promise<Response> {
  const resolved = await resolvePresignedDownloadUrl(req, key)
  if (!resolved.ok) {
    return new NextResponse(resolved.message, {
      status: resolved.status,
      headers: proxyErrorHeaders(resolved.message),
    })
  }
  return fetchBinary(resolved.url, rangeHeader)
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
  const rangeHeader = req.headers.get('range')

  if (key) {
    try {
      return await fetchViaPresignedKey(req, key, rangeHeader)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'presign failed'
      console.error('[files/model] GET key failed', msg)
      if (!(url && /^https?:\/\//i.test(url))) {
        return new NextResponse(`Model proxy failed: ${asciiHeader(msg)}`, {
          status: 502,
          headers: proxyErrorHeaders(msg),
        })
      }
    }
  }

  if (url && /^https?:\/\//i.test(url)) {
    try {
      return await fetchBinary(url, rangeHeader)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'fetch failed'
      return new NextResponse(`Fetch failed: ${asciiHeader(msg)}`, {
        status: 502,
        headers: proxyErrorHeaders(msg),
      })
    }
  }

  return new NextResponse('Missing or invalid url/key', { status: 400 })
}

/**
 * Cheap availability check used before useGLTF mounts.
 * For `key=`, run the same presign+storage path as GET but only pull 1 byte
 * so we don't mark GLBs ready when storage is unreachable.
 */
export async function HEAD(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const key = searchParams.get('key')

  try {
    if (key) {
      const resolved = await resolvePresignedDownloadUrl(req, key)
      if (!resolved.ok) {
        return new NextResponse(null, {
          status: resolved.status,
          headers: proxyErrorHeaders(resolved.message),
        })
      }
      let target = maybeRewriteStorageUrl(resolved.url)
      let host = storageHost(target)
      const probeOnce = async (fetchUrl: string) => {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 12_000)
        try {
          return await fetch(fetchUrl, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' },
            cache: 'no-store',
            redirect: 'follow',
            credentials: 'omit',
            signal: ctrl.signal,
          })
        } finally {
          clearTimeout(timer)
        }
      }
      try {
        let probe: globalThis.Response
        try {
          probe = await probeOnce(target)
        } catch (e) {
          const httpFallback = isTlsMismatchError(e) ? asHttpUrl(target) : null
          if (!httpFallback) throw e
          console.warn('[files/model] HEAD HTTPS TLS failed; retrying over HTTP', { host })
          probe = await probeOnce(httpFallback)
          target = httpFallback
          host = storageHost(target)
        }
        if (probe.ok || probe.status === 206 || probe.status === 200) {
          return new NextResponse(null, {
            status: 200,
            headers: {
              'Content-Type': 'model/gltf-binary',
              'Cache-Control': 'public, max-age=60',
            },
          })
        }
        const detail = `Storage probe HTTP ${probe.status}${host ? ` @ ${host}` : ''}`
        console.error('[files/model] HEAD probe failed', detail)
        return new NextResponse(null, {
          status: probe.status >= 400 && probe.status < 600 ? probe.status : 502,
          headers: proxyErrorHeaders(detail),
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'storage probe failed'
        const cause =
          e instanceof Error && e.cause instanceof Error ? e.cause.message : undefined
        console.error('[files/model] HEAD storage unreachable', { host, msg, cause })
        return new NextResponse(null, {
          status: 502,
          headers: proxyErrorHeaders(`${cause || msg}${host ? ` @ ${host}` : ''}`),
        })
      }
    }

    if (url && /^https?:\/\//i.test(url)) {
      try {
        const target = maybeRewriteStorageUrl(url)
        const probe = await fetch(target, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          cache: 'no-store',
          redirect: 'follow',
          credentials: 'omit',
        })
        if (probe.ok || probe.status === 206 || probe.status === 200) {
          return new NextResponse(null, { status: 200 })
        }
        return new NextResponse(null, { status: probe.status })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'upstream head failed'
        return new NextResponse(null, {
          status: 502,
          headers: proxyErrorHeaders(msg),
        })
      }
    }

    return new NextResponse(null, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'head failed'
    return new NextResponse(null, {
      status: 502,
      headers: proxyErrorHeaders(msg),
    })
  }
}