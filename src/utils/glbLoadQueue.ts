import { preloadProductGlb } from '@/components/ProductGlbModel'
import {
  canonicalFileCacheKey,
  isGlbPath,
  resolveProductModelUrl,
} from '@/utils/productModelUrl'

const MAX_CONCURRENT = 2
const MAX_RETRIES = 4
const BASE_RETRY_MS = 400

let active = 0
const waiters: Array<() => void> = []

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function acquireSlot() {
  if (active < MAX_CONCURRENT) {
    active++
    return
  }
  await new Promise<void>((resolve) => waiters.push(resolve))
  active++
}

function releaseSlot() {
  active = Math.max(0, active - 1)
  const next = waiters.shift()
  if (next) next()
}

async function fetchWithRetry(url: string): Promise<Response> {
  let last: Response | null = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // No Range header — must match the useGLTF GET cache key.
    // After a cached 429, `reload` replaces that disk entry with a fresh 200.
    last = await fetch(url, {
      method: 'GET',
      cache: attempt === 0 ? 'default' : 'reload',
    })
    if (last.status !== 429 && last.status !== 503) return last
    const retryAfter = Number(last.headers.get('Retry-After'))
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : BASE_RETRY_MS * 2 ** attempt
    await sleep(waitMs)
  }
  return last!
}

/** Throttled byte-range probe — one in-flight task per canonical GLB key. */
export function queueGlbProbe(url: string): Promise<boolean> {
  const key = canonicalFileCacheKey(url)
  return enqueueGlbTask(key, async () => {
    const res = await fetchWithRetry(url)
    const ok = res.ok || res.status === 206
    if (!ok && (res.status === 429 || res.status === 503)) {
      retryableKeys.add(key)
    } else {
      retryableKeys.delete(key)
    }
    return ok
  })
}

const taskCache = new Map<string, { ok: boolean; at: number }>()
const taskInflight = new Map<string, Promise<boolean>>()
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
const TASK_TTL_MS = 5 * 60_000
const FAIL_TTL_MS = 8_000

function enqueueGlbTask(key: string, task: () => Promise<boolean>): Promise<boolean> {
  const cached = taskCache.get(key)
  if (cached) {
    const ttl = cached.ok ? TASK_TTL_MS : FAIL_TTL_MS
    if (Date.now() - cached.at < ttl) {
      return Promise.resolve(cached.ok)
    }
  }
  const running = taskInflight.get(key)
  if (running) return running

  const pending = (async () => {
    await acquireSlot()
    try {
      const ok = await task()
      taskCache.set(key, { ok, at: Date.now() })
      return ok
    } catch {
      taskCache.set(key, { ok: false, at: Date.now() })
      return false
    } finally {
      releaseSlot()
      taskInflight.delete(key)
    }
  })()

  taskInflight.set(key, pending)
  return pending
}

const readyListeners = new Map<string, Set<() => void>>()
const readyKeys = new Set<string>()
const failedKeys = new Set<string>()
const retryableKeys = new Set<string>()

function notify(key: string) {
  const subs = readyListeners.get(key)
  if (!subs) return
  for (const cb of subs) cb()
}

/** Warm a GLB through the queue, then mark ready for Product mounts. */
export function ensureGlbReady(url: string): Promise<boolean> {
  const key = canonicalFileCacheKey(url)
  if (readyKeys.has(key)) return Promise.resolve(true)

  return queueGlbProbe(url).then((ok) => {
    if (ok) {
      readyKeys.add(key)
      failedKeys.delete(key)
      retryableKeys.delete(key)
      const pending = retryTimers.get(key)
      if (pending) {
        clearTimeout(pending)
        retryTimers.delete(key)
      }
    } else {
      failedKeys.add(key)
      if (retryableKeys.has(key) && !retryTimers.has(key)) {
        const timer = setTimeout(() => {
          retryTimers.delete(key)
          failedKeys.delete(key)
          taskCache.delete(key)
          retryableKeys.delete(key)
          void ensureGlbReady(url)
        }, FAIL_TTL_MS)
        retryTimers.set(key, timer)
      }
    }
    notify(key)
    return ok
  })
}

export function isGlbReady(url: string | null | undefined): boolean {
  if (!url) return false
  return readyKeys.has(canonicalFileCacheKey(url))
}

export function isGlbFailed(url: string | null | undefined): boolean {
  if (!url) return false
  return failedKeys.has(canonicalFileCacheKey(url))
}

export function subscribeGlbReady(url: string, listener: () => void): () => void {
  const key = canonicalFileCacheKey(url)
  let set = readyListeners.get(key)
  if (!set) {
    set = new Set()
    readyListeners.set(key, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
    if (set?.size === 0) readyListeners.delete(key)
  }
}

type RackLike = {
  sides: Array<{
    rows: Array<{
      bins: Array<{
        products: Array<{
          modelUrl?: string | null
          modelStorageKey?: string | null
        }>
      }>
    }>
  }>
}

/** Preload unique GLB proxy URLs from loaded racks (sequential queue, non-blocking). */
export function preloadRackGlbs(racks: RackLike[]) {
  if (typeof window === 'undefined') return

  const urls = new Set<string>()
  for (const rack of racks) {
    for (const side of rack.sides) {
      for (const row of side.rows) {
        for (const bin of row.bins) {
          for (const product of bin.products) {
            const url = resolveProductModelUrl(product)
            if (url && isGlbPath(url)) urls.add(url)
          }
        }
      }
    }
  }

  void (async () => {
    for (const url of urls) {
      const ok = await ensureGlbReady(url)
      if (ok) preloadProductGlb(url)
    }
  })()
}
