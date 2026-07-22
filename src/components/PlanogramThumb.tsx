'use client'

import type { ShelfListItem } from '@/types/shelf'
import { cn } from '@/lib/cn'

/** Lightweight 2D elevation sketch for planogram cards (no server image required). */
export function PlanogramThumb({
  item,
  className,
}: {
  item: ShelfListItem
  className?: string
}) {
  const levels = item.fixtureType === 'END_CAP' ? 3 : item.fixtureType === 'PEGBOARD' ? 5 : 4
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
        <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} rx={3} fill="#e8eaed" stroke="#1a1a1a" strokeWidth={2} />
        {Array.from({ length: levels }).map((_, i) => {
          const y = pad + (i + 1) * shelfH - 3
          return (
            <g key={i}>
              <rect x={pad + 4} y={y - 2} width={w - pad * 2 - 8} height={4} fill="#1a1a1a" rx={1} />
              {/* fake product blocks */}
              <rect x={pad + 10} y={y - shelfH + 8} width={18} height={shelfH - 14} fill="#2C5282" opacity={0.55} rx={2} />
              <rect x={pad + 34} y={y - shelfH + 12} width={14} height={shelfH - 18} fill="#27ae60" opacity={0.5} rx={2} />
              <rect x={pad + 54} y={y - shelfH + 10} width={22} height={shelfH - 16} fill="#8e44ad" opacity={0.45} rx={2} />
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
