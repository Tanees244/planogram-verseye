'use client'

import type { ImportReport } from '@/lib/planogram-formats'
import { FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi'

export function PlanogramImportReport({ report }: { report: ImportReport }) {
  const errors = report.issues.filter((issue) => issue.severity === 'error')
  const warnings = report.issues.filter((issue) => issue.severity === 'warning')

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        {errors.length > 0 ? (
          <FiAlertCircle className="text-red-500 text-xl shrink-0 mt-0.5" />
        ) : (
          <FiCheckCircle className="text-emerald-500 text-xl shrink-0 mt-0.5" />
        )}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {report.planogramName ?? 'Import summary'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Format: <span className="font-mono uppercase">{report.format}</span>
            {' · '}
            {report.racksImported} racks, {report.rowsImported} shelves, {report.binsImported} shelf slots,{' '}
            {report.facingsImported} facings
          </p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-amber-900 font-medium text-sm mb-2">
            <FiInfo />
            {warnings.length} element{warnings.length === 1 ? '' : 's'} could not be fully resolved
          </div>
          <ul className="space-y-1.5 text-sm text-amber-900/90 max-h-40 overflow-y-auto">
            {warnings.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span className="font-mono text-[11px] text-amber-700">{issue.code}</span>
                {issue.path ? <span className="text-amber-700"> @ {issue.path}</span> : null}
                {' — '}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center gap-2 text-red-900 font-medium text-sm mb-2">
            <FiAlertCircle />
            {errors.length} import error{errors.length === 1 ? '' : 's'}
          </div>
          <ul className="space-y-1.5 text-sm text-red-900/90 max-h-40 overflow-y-auto">
            {errors.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                <span className="font-mono text-[11px] text-red-700">{issue.code}</span>
                {issue.path ? <span className="text-red-700"> @ {issue.path}</span> : null}
                {' — '}
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
