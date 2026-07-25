'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { getPlanogramTokenFromCookie } from '@verseye/utils'
import type { ShelfListItem } from '@/types/shelf'

export type ElevationSku = {
  name?: string
  skuName?: string
  imageUrl?: string | null
  color?: string
  quantity?: number
  facingCount?: number
  width?: number
  height?: number
}

export type ElevationBin = {
  binName?: string
  width?: number
  products?: ElevationSku[]
}

export type ElevationRow = {
  rowNumber?: number
  rowLabel?: string | null
  width?: number | null
  height?: number | null
  bins?: ElevationBin[]
  skus?: ElevationSku[]
}

const PALETTE = ['#2C5282', '#27ae60', '#8e44ad', '#e67e22', '#c0392b', '#16a085', '#2980b9']

function asArray(value: unknown): unknown[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  const o = value as Record<string, unknown>
  return (o.items ?? o.results ?? o.data ?? []) as unknown[]
}

function skuBlocks(row: ElevationRow): ElevationSku[] {
  const direct = asArray(row.skus) as ElevationSku[]
  if (direct.length) return direct
  const fromBins = asArray(row.bins).flatMap((bin) =>
    asArray((bin as ElevationBin).products),
  ) as ElevationSku[]
  return fromBins
}

function facingsOf(sku: ElevationSku): number {
  return Math.max(1, Math.floor(Number(sku.quantity ?? sku.facingCount) || 1))
}

/** Real 2D shelf elevation from blueprint rows / bins / SKUs. */
export function PlanogramElevation2D({
  rows,
  className,
  title,
}: {
  rows: ElevationRow[]
  className?: string
  title?: string
}) {
  const levels = Math.max(1, rows.length)
  const w = 320
  const h = Math.max(140, 36 + levels * 52)
  const pad = 12
  const shelfH = (h - pad * 2) / levels

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200',
        className,
      )}
      role="img"
      aria-label={title ?? 'Planogram elevation'}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full block">
        <rect
          x={pad}
          y={pad}
          width={w - pad * 2}
          height={h - pad * 2}
          rx={4}
          fill="#eef1f4"
          stroke="#1a1a1a"
          strokeWidth={2}
        />
        {rows.map((row, i) => {
          const yShelf = pad + (i + 1) * shelfH - 3
          const blocks = skuBlocks(row)
          const innerW = w - pad * 2 - 16
          const totalFacings = blocks.reduce((s, b) => s + facingsOf(b), 0) || 1
          let x = pad + 8
          return (
            <g key={row.rowNumber ?? i}>
              <rect
                x={pad + 4}
                y={yShelf - 2}
                width={w - pad * 2 - 8}
                height={4}
                fill="#1a1a1a"
                rx={1}
              />
              {blocks.length === 0 ? (
                <text
                  x={pad + 12}
                  y={yShelf - shelfH / 2 + 4}
                  fontSize={9}
                  fill="#94a3b8"
                >
                  Empty
                </text>
              ) : (
                blocks.flatMap((sku, si) => {
                  const n = facingsOf(sku)
                  const blockW = Math.max(10, (innerW * n) / totalFacings - 2)
                  const blockH = Math.min(shelfH - 12, Math.max(14, (Number(sku.height) || 0.2) * 80))
                  const fill = sku.color || PALETTE[si % PALETTE.length]
                  const nodes = []
                  for (let f = 0; f < n; f++) {
                    const fx = x + f * (blockW / n)
                    const fw = blockW / n - 1
                    nodes.push(
                      <g key={`${i}-${si}-${f}`}>
                        {sku.imageUrl ? (
                          <image
                            href={sku.imageUrl}
                            x={fx}
                            y={yShelf - blockH - 4}
                            width={Math.max(fw, 8)}
                            height={blockH}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        ) : (
                          <rect
                            x={fx}
                            y={yShelf - blockH - 4}
                            width={Math.max(fw, 8)}
                            height={blockH}
                            fill={fill}
                            opacity={0.85}
                            rx={2}
                          />
                        )}
                      </g>,
                    )
                  }
                  x += blockW + 2
                  return nodes
                })
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const blueprintCache = new Map<string, ElevationRow[] | null>()

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

async function fetchElevationRows(shelfId: string): Promise<ElevationRow[] | null> {
  if (blueprintCache.has(shelfId)) return blueprintCache.get(shelfId) ?? null
  try {
    const res = await fetch(`/api/layout/shelves/${encodeURIComponent(shelfId)}/blueprint`, {
      headers: authHeaders(),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false || json?.success === false) {
      blueprintCache.set(shelfId, null)
      return null
    }
    const d = json?.data ?? json
    const side = d.side ?? null
    const shelf = d.shelf ?? d
    const rows = asArray(side?.rows ?? shelf.rows ?? d.rows) as ElevationRow[]
    blueprintCache.set(shelfId, rows)
    return rows
  } catch {
    blueprintCache.set(shelfId, null)
    return null
  }
}

/** List-card thumb: loads real blueprint elevation when available; fixture sketch otherwise. */
export function PlanogramThumb({
  item,
  className,
}: {
  item: ShelfListItem
  className?: string
}) {
  const [rows, setRows] = useState<ElevationRow[] | null>(() =>
    blueprintCache.has(item.id) ? blueprintCache.get(item.id) ?? null : null,
  )
  const [tried, setTried] = useState(blueprintCache.has(item.id))

  useEffect(() => {
    if (item.hasLayout === false) {
      setTried(true)
      setRows(null)
      return
    }
    let cancelled = false
    void (async () => {
      const next = await fetchElevationRows(item.id)
      if (!cancelled) {
        setRows(next)
        setTried(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [item.id, item.hasLayout])

  const levels = useMemo(
    () => (item.fixtureType === 'END_CAP' ? 3 : item.fixtureType === 'PEGBOARD' ? 5 : 4),
    [item.fixtureType],
  )

  if (rows && rows.length > 0) {
    return (
      <div className={cn('relative', className)}>
        <PlanogramElevation2D rows={rows} className="h-full w-full" title={item.name} />
        {item.hasLayout === false && (
          <span className="absolute bottom-1.5 left-1.5 text-[9px] font-semibold uppercase tracking-wide bg-white/90 text-gray-600 px-1.5 py-0.5 rounded">
            No layout
          </span>
        )}
      </div>
    )
  }

  const w = 160
  const h = 100
  const pad = 10
  const shelfH = (h - pad * 2) / levels

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 to-slate-200 border border-slate-200',
        className,
      )}
      aria-hidden
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full block">
        <rect
          x={pad}
          y={pad}
          width={w - pad * 2}
          height={h - pad * 2}
          rx={3}
          fill="#e8eaed"
          stroke="#1a1a1a"
          strokeWidth={2}
        />
        {Array.from({ length: levels }).map((_, i) => {
          const y = pad + (i + 1) * shelfH - 3
          return (
            <g key={i}>
              <rect
                x={pad + 4}
                y={y - 2}
                width={w - pad * 2 - 8}
                height={4}
                fill="#1a1a1a"
                rx={1}
              />
              {!tried ? (
                <rect
                  x={pad + 10}
                  y={y - shelfH + 10}
                  width={w - pad * 2 - 20}
                  height={shelfH - 16}
                  fill="#cbd5e1"
                  opacity={0.5}
                  rx={2}
                />
              ) : (
                <>
                  <rect
                    x={pad + 10}
                    y={y - shelfH + 8}
                    width={18}
                    height={shelfH - 14}
                    fill="#2C5282"
                    opacity={0.35}
                    rx={2}
                  />
                  <rect
                    x={pad + 34}
                    y={y - shelfH + 12}
                    width={14}
                    height={shelfH - 18}
                    fill="#27ae60"
                    opacity={0.3}
                    rx={2}
                  />
                </>
              )}
            </g>
          )
        })}
      </svg>
      {item.hasLayout === false && (
        <span className="absolute bottom-1.5 left-1.5 text-[9px] font-semibold uppercase tracking-wide bg-white/90 text-gray-600 px-1.5 py-0.5 rounded">
          No layout
        </span>
      )}
    </div>
  )
}
