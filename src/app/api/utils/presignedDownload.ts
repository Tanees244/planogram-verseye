import type { NextRequest } from 'next/server'
import { getToken } from '@/app/api/utils/getToken'

const API_BASE_URL = process.env.API_BASE_URL
const PRESIGN_CACHE_TTL_MS = 300_000
const PRESIGN_RATE_LIMIT_COOLDOWN_MS = 8_000
const MAX_PRESIGN_CONCURRENT = 2
const PRESIGN_MAX_RETRIES = 4

type PresignCacheEntry = { url: string; expiresAt: number }
export type PresignResult =
  | { ok: true; url: string }
  | { ok: false; status: number; message: string }

const presignCache = new Map<string, PresignCacheEntry>()
const presignInflight = new Map<string, Promise<PresignResult>>()
let presign429Until = 0
let presignActive = 0
const presignWaiters: Array<() => void> = []

async function withPresignSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (presignActive >= MAX_PRESIGN_CONCURRENT) {
    await new Promise<void>((resolve) => presignWaiters.push(resolve))
  }
  presignActive++
  try {
    return await fn()
  } finally {
    presignActive = Math.max(0, presignActive - 1)
    presignWaiters.shift()?.()
  }
}

function sleepMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function markRateLimited(retryAfterHeader?: string | null) {
  const fromHeader = retryAfterHeader ? Number(retryAfterHeader) : NaN
  const waitMs =
    Number.isFinite(fromHeader) && fromHeader > 0
      ? Math.min(Math.max(fromHeader, 1) * 1000, 60_000)
      : PRESIGN_RATE_LIMIT_COOLDOWN_MS
  presign429Until = Math.max(presign429Until, Date.now() + waitMs)
}

async function waitIfRateLimited() {
  const remaining = presign429Until - Date.now()
  if (remaining > 0) {
    await sleepMs(Math.min(remaining, 8_000))
  }
}

export function pickPresignedDownloadUrl(payload: Record<string, unknown>): string | null {
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

/** Recover object key from a MinIO/S3 signed URL path. */
export function storageKeyFromSignedUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const parts = path.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const key = parts.slice(1).join('/')
    if (!key || key.includes('..')) return null
    return key
  } catch {
    return null
  }
}

/**
 * Resolve a fresh presigned download URL via POST /api/v1/files/presigned-download.
 * Shared by /api/files/image and /api/files/model (cached, throttled, retries 429).
 */
export async function resolvePresignedDownloadUrl(
  req: NextRequest,
  key: string,
  logTag = 'files/presign',
): Promise<PresignResult> {
  const cached = presignCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, url: cached.url }
  }
  const running = presignInflight.get(key)
  if (running) return running

  const task = (async (): Promise<PresignResult> => {
    if (!API_BASE_URL) {
      return { ok: false, status: 502, message: 'API_BASE_URL is not configured' }
    }
    const token = await getToken(req)
    if (!token) {
      return { ok: false, status: 401, message: 'Unauthorized - no planogram token' }
    }

    for (let attempt = 0; attempt < PRESIGN_MAX_RETRIES; attempt++) {
      const cachedNow = presignCache.get(key)
      if (cachedNow && cachedNow.expiresAt > Date.now()) {
        return { ok: true, url: cachedNow.url }
      }
      await waitIfRateLimited()

      let presignRes: globalThis.Response
      try {
        presignRes = await withPresignSlot(() =>
          fetch(`${API_BASE_URL}/api/v1/files/presigned-download`, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ objectKey: key }),
            cache: 'no-store',
          }),
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'presign request failed'
        console.error(`[${logTag}] presign request failed`, msg)
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
          : null) || pickPresignedDownloadUrl(inner)

      if (presignRes.ok && downloadUrl) {
        presignCache.set(key, {
          url: downloadUrl,
          expiresAt: Date.now() + PRESIGN_CACHE_TTL_MS,
        })
        return { ok: true, url: downloadUrl }
      }

      if (presignRes.status === 429) {
        markRateLimited(presignRes.headers.get('retry-after'))
        if (cachedNow?.url) return { ok: true, url: cachedNow.url }
        continue
      }

      const snippet = presignText.slice(0, 180).replace(/[^\x20-\x7E]/g, '-')
      const message = `Could not resolve download URL (${presignRes.status})${snippet ? `: ${snippet}` : ''}`
      console.error(`[${logTag}]`, message, { key })
      return {
        ok: false,
        status: !presignRes.ok ? presignRes.status || 502 : 502,
        message,
      }
    }

    const stale = presignCache.get(key)
    if (stale?.url) return { ok: true, url: stale.url }
    return {
      ok: false,
      status: 429,
      message: 'Presign is temporarily rate-limited; retry shortly',
    }
  })()

  presignInflight.set(key, task)
  try {
    return await task
  } finally {
    presignInflight.delete(key)
  }
}
