'use client'

import type { Rack } from '@/store/planogramStore'
import {
  formatZoneFootprint,
  formatZoneVolume,
  resolveSideZoneDefaults,
  validateSideZones,
} from '@/utils/rackZones'
import { cn } from '@/lib/cn'

export function RackSideZonesPanel({
  rack,
  dark = true,
}: {
  rack: Rack
  dark?: boolean
}) {
  const side = rack.sides[0]
  if (!side) return null

  const zones = resolveSideZoneDefaults(side, rack)
  const issues = validateSideZones(side, rack)

  return (
    <div
      className={cn(
        'w-full rounded-xl border p-2.5 space-y-2',
        dark ? 'bg-black/70 border-white/10 text-gray-100' : 'bg-white border-gray-200 text-gray-800',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wide',
          dark ? 'text-gray-400' : 'text-gray-500',
        )}
      >
        Side zones · {side.sideCode}
      </p>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
        <dt className={dark ? 'text-gray-500' : 'text-gray-400'}>Inner</dt>
        <dd>{formatZoneFootprint(zones.inner)}</dd>
        <dt className={dark ? 'text-gray-500' : 'text-gray-400'}>Outer lip</dt>
        <dd>{formatZoneFootprint(zones.outer)}</dd>
        <dt className={dark ? 'text-gray-500' : 'text-gray-400'}>Header</dt>
        <dd>{formatZoneVolume(zones.header)}</dd>
        <dt className={dark ? 'text-gray-500' : 'text-gray-400'}>Footer</dt>
        <dd>{formatZoneVolume(zones.footer)}</dd>
      </dl>
      {issues.length > 0 && (
        <ul className="space-y-1 pt-1 border-t border-amber-500/30">
          {issues.slice(0, 3).map((issue) => (
            <li key={issue.message} className="text-[10px] text-amber-300/90 leading-snug">
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
