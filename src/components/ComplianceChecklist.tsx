'use client'

import { useMemo } from 'react'
import type { Rack } from '@/store/planogramStore'
import { evaluateRackCompliance, type ComplianceItem } from '@/utils/planogramCompliance'
import { cn } from '@/lib/cn'
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi'

function SeverityIcon({ severity }: { severity: ComplianceItem['severity'] }) {
  if (severity === 'error') {
    return <FiAlertCircle className="shrink-0 text-red-500" size={16} />
  }
  if (severity === 'warning') {
    return <FiAlertTriangle className="shrink-0 text-amber-500" size={16} />
  }
  if (severity === 'pass') {
    return <FiCheckCircle className="shrink-0 text-emerald-500" size={16} />
  }
  return <FiInfo className="shrink-0 text-sky-500" size={16} />
}

export function ComplianceChecklist({
  rack,
  compact = false,
  className,
}: {
  rack: Rack
  compact?: boolean
  className?: string
}) {
  const report = useMemo(() => evaluateRackCompliance(rack), [rack])

  const grouped = useMemo(() => {
    const order: ComplianceItem['severity'][] = ['error', 'warning', 'info', 'pass']
    const sorted = [...report.items].sort(
      (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
    )
    if (compact) {
      const nonPass = sorted.filter((i) => i.severity !== 'pass' && i.severity !== 'info')
      return nonPass.length > 0 ? nonPass : sorted.slice(0, 3)
    }
    return sorted
  }, [compact, report.items])

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'rounded-lg border px-3 py-2.5 text-sm flex items-center justify-between gap-3',
          report.ready
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-red-200 bg-red-50 text-red-900',
        )}
      >
        <span className="font-semibold">
          {report.ready ? 'Ready to publish' : 'Fix blocking issues before publish'}
        </span>
        <span className="text-xs font-medium tabular-nums">
          {report.errorCount} error{report.errorCount === 1 ? '' : 's'} ·{' '}
          {report.warningCount} warning{report.warningCount === 1 ? '' : 's'}
          {!compact && report.passCount > 0 ? ` · ${report.passCount} passed` : ''}
        </span>
      </div>

      <ul className="space-y-1.5 max-h-64 overflow-y-auto">
        {grouped.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex gap-2 rounded-lg border px-3 py-2 text-sm',
              item.severity === 'error' && 'border-red-100 bg-red-50/80',
              item.severity === 'warning' && 'border-amber-100 bg-amber-50/80',
              item.severity === 'pass' && 'border-emerald-100 bg-emerald-50/60',
              item.severity === 'info' && 'border-sky-100 bg-sky-50/60',
            )}
          >
            <SeverityIcon severity={item.severity} />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 leading-snug">{item.title}</p>
              {item.detail ? (
                <p className="text-xs text-gray-600 mt-0.5 leading-snug">{item.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
