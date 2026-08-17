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
    last = await fetch(url, {
      method: 'GET',
      cache: 'force-cache',
      headers: { Range: 'bytes=0-0' },
    })
    if (last.status !== 429) return last
    await sleep(BASE_RETRY_MS * (attempt + 1))
  }
  return last!
}

/** Throttled byte-range probe — one in-flight task per canonical GLB key. */
export function queueGlbProbe(url: string): Promise<boolean> {
  const key = canonicalFileCacheKey(url)
  return enqueueGlbTask(key, async () => {
    const res = await fetchWithRetry(url)
    return res.ok || res.status === 206
  })
}

const taskCache = new Map<string, { ok: boolean; at: number }>()
const taskInflight = new Map<string, Promise<boolean>>()
const TASK_TTL_MS = 5 * 60_000

function enqueueGlbTask(key: string, task: () => Promise<boolean>): Promise<boolean> {
  const cached = taskCache.get(key)
  if (cached && Date.now() - cached.at < TASK_TTL_MS) {
    return Promise.resolve(cached.ok)
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

function notify(key: string) {
  const subs = readyListeners.get(key)
  if (!subs) return
  for (const cb of subs) cb()
}

/** Warm a GLB through the queue, then mark ready for Product mounts. */
export function ensureGlbReady(url: string): Promise<boolean> {
  const key = canonicalFileCacheKey(url)
  if (readyKeys.has(key)) return Promise.resolve(true)
  if (failedKeys.has(key)) return Promise.resolve(false)

  return queueGlbProbe(url).then((ok) => {
    if (ok) {
      readyKeys.add(key)
      failedKeys.delete(key)
    } else {
      failedKeys.add(key)
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
