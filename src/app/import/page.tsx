'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePlanogramStore } from '@/store/planogramStore'
import {
  detectPlanogramFormat,
  isLegacyPlanogramJson,
  migrateLegacyJsonLabel,
  type ImportReport,
} from '@/lib/planogram-formats'
import { PlanogramImportReport } from '@/components/PlanogramImportReport'
import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/cn'
import {
  FiUpload,
  FiX,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
  FiArrowRight,
  FiArrowLeft,
  FiClipboard,
  FiTrash2,
} from 'react-icons/fi'

const ACCEPT = '.psa,.plm,.json,application/json,text/plain'

export default function ImportPage() {
  const router = useRouter()
  const loadFromJSON = usePlanogramStore((state) => state.loadFromJSON)
  const importPlanogramFromContent = usePlanogramStore(
    (state) => state.importPlanogramFromContent,
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileInput, setFileInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importSucceeded, setImportSucceeded] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const applyFileContent = useCallback((content: string, name: string | null) => {
    setFileName(name)
    setFileInput(content)
    setDetectedFormat(content.trim() ? detectPlanogramFormat(content, name ?? undefined) : null)
    setError(null)
    setImportReport(null)
    setImportSucceeded(false)
  }, [])

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          applyFileContent(String(event.target?.result ?? ''), file.name)
        } catch (err: unknown) {
          setError(
            'Error reading file: ' + (err instanceof Error ? err.message : 'unknown error'),
          )
        }
      }
      reader.readAsText(file)
    },
    [applyFileContent],
  )

  const clearSource = () => {
    applyFileContent('', null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleImport = async () => {
    try {
      setError(null)
      setImportReport(null)
      setImportSucceeded(false)
      setIsLoading(true)
      setProgress(0)

      const content = fileInput.trim()
      if (!content) {
        setError('Paste a planogram file or upload one first.')
        return
      }

      const format = detectPlanogramFormat(content, fileName ?? undefined)
      setDetectedFormat(format)

      if (format === 'legacy-json') {
        const parsed = JSON.parse(content)
        if (!isLegacyPlanogramJson(parsed)) {
          setError('Legacy JSON is missing layout.racks[]')
          return
        }
        await loadFromJSON(parsed, setProgress)
        setImportReport({
          format: 'legacy-json',
          planogramName: migrateLegacyJsonLabel(),
          racksImported: parsed.layout?.racks?.length ?? 0,
          rowsImported: 0,
          binsImported: 0,
          productsImported: 0,
          facingsImported: 0,
          issues: [
            {
              severity: 'warning',
              code: 'LegacyMigrated',
              message:
                'Imported via legacy JSON migration path. Consider re-exporting as PLM for full fidelity.',
            },
          ],
        })
        setImportSucceeded(true)
        return
      }

      if (format === 'unknown') {
        setError('Unrecognized file format. Upload a .psa, .plm, or legacy JSON planogram.')
        return
      }

      const result = await importPlanogramFromContent(content, fileName ?? undefined)
      setImportReport(result.report)

      if (!result.success) {
        setError(result.message ?? 'Import failed')
      } else {
        setProgress(100)
        setImportSucceeded(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid planogram file')
      setProgress(0)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) readFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && fileInput && !isLoading) {
      void handleImport()
    }
  }

  const canImport = Boolean(fileInput.trim()) && !isLoading && !importSucceeded
  const charCount = fileInput.length

  return (
    <div className="h-dvh max-h-dvh bg-[#eef2f7] flex flex-col overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0 opacity-70 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(44,82,130,0.18), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(16,185,129,0.08), transparent)',
        }}
      />

      {isLoading && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-[#0f172a] px-5 py-4 text-white shadow-2xl min-w-[280px]">
            <Spinner className="h-5 w-5 text-sky-300" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Importing planogram…</p>
              <p className="text-[11px] text-slate-300">Parsing fixtures, shelves, and products</p>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-sky-400 transition-all duration-300"
                  style={{ width: `${Math.max(progress, 8)}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-bold tabular-nums text-sky-200">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      )}

      <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-8">
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2C5282] hover:text-[#1A365D] transition-colors mb-4"
            >
              <FiArrowLeft size={14} />
              Back to 3D builder
            </Link>
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2C5282] text-white shadow-lg shadow-[#2C5282]/30 shrink-0">
                <FiFileText size={22} />
              </span>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                  Import Planogram
                </h1>
                <p className="mt-1.5 text-slate-600 text-base leading-relaxed max-w-xl">
                  Bring industry-standard <strong className="text-slate-800">.psa</strong> or{' '}
                  <strong className="text-slate-800">.plm</strong> files — or legacy JSON — into the
                  3D builder.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { ext: '.plm', label: 'Layout Model' },
                { ext: '.psa', label: 'Space Planning' },
                { ext: 'JSON', label: 'Legacy' },
              ].map((f) => (
                <span
                  key={f.ext}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm"
                >
                  <span className="font-mono text-[#2C5282]">{f.ext}</span>
                  <span className="text-slate-400">·</span>
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-4">
          {/* Drop zone */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <FiUpload className="text-[#2C5282]" size={14} />
                Upload file
              </h2>
              {fileName && (
                <button
                  type="button"
                  onClick={clearSource}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
                >
                  <FiTrash2 size={12} />
                  Clear
                </button>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={handleFileUpload}
              className="sr-only"
              id="planogram-file-input"
            />

            <label
              htmlFor="planogram-file-input"
              onDragEnter={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setDragOver(false)
              }}
              onDrop={handleDrop}
              className={cn(
                'group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 cursor-pointer transition-all duration-200',
                dragOver
                  ? 'border-[#2C5282] bg-[#2C5282]/8 scale-[1.01]'
                  : fileName
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : 'border-slate-300 bg-slate-50/80 hover:border-[#2C5282]/60 hover:bg-sky-50',
              )}
            >
              <span
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105',
                  fileName ? 'bg-emerald-500 text-white' : 'bg-[#2C5282]/10 text-[#2C5282]',
                )}
              >
                {fileName ? <FiCheckCircle size={26} /> : <FiUpload size={26} />}
              </span>
              {fileName ? (
                <>
                  <p className="text-sm font-semibold text-slate-900 text-center break-all px-2">
                    {fileName}
                  </p>
                  <p className="text-xs text-emerald-700 font-medium">
                    Ready to import · click or drop to replace
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-800 text-center">
                    Drag & drop your planogram here
                  </p>
                  <p className="text-xs text-slate-500 text-center">
                    or{' '}
                    <span className="text-[#2C5282] font-semibold underline-offset-2 group-hover:underline">
                      browse files
                    </span>{' '}
                    · .psa · .plm · .json
                  </p>
                </>
              )}
            </label>

            {detectedFormat && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Detected
                </span>
                <span className="inline-flex items-center rounded-lg bg-[#2C5282]/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-[#2C5282]">
                  {detectedFormat}
                </span>
                {charCount > 0 && (
                  <span className="text-xs text-slate-400 ml-auto tabular-nums">
                    {(charCount / 1024).toFixed(1)} KB text
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Paste */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-3">
              <FiClipboard className="text-[#2C5282]" size={14} />
              Or paste contents
            </h2>
            <textarea
              value={fileInput}
              onChange={(e) => {
                const v = e.target.value
                setFileInput(v)
                setFileName(null)
                setImportSucceeded(false)
                setImportReport(null)
                setError(null)
                setDetectedFormat(v.trim() ? detectPlanogramFormat(v) : null)
              }}
              onKeyDown={handleKeyPress}
              placeholder="Paste .psa, .plm, or legacy JSON…&#10;&#10;Ctrl+Enter to import"
              className="w-full min-h-[140px] max-h-[280px] p-4 font-mono text-[13px] leading-relaxed border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2C5282]/35 focus:border-[#2C5282]/50 focus:bg-white resize-y transition-colors"
            />
            <p className="mt-2 text-[11px] text-slate-400">
              Tip: <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Ctrl</kbd>
              +
              <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Enter</kbd>
              {' '}imports from the paste box
            </p>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 animate-in fade-in duration-200">
              <FiAlertCircle className="text-red-500 text-xl shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Import failed</p>
                <p className="text-red-700 text-sm mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {importReport && !isLoading && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <PlanogramImportReport report={importReport} />
              {importSucceeded && (
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-lg shadow-emerald-600/25 hover:scale-[1.01] active:scale-[0.99]"
                >
                  Open in 3D builder
                  <FiArrowRight />
                </button>
              )}
            </div>
          )}

          {/* Formats help */}
          <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 sm:p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FiCheckCircle className="text-emerald-500" size={16} />
              Supported formats
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600 leading-relaxed">
              <li>
                <strong className="text-slate-900 font-mono">.plm</strong> — Planogram Layout Model
                (JSON). Full round-trip for fixtures, shelves, bins, products, and facings.
              </li>
              <li>
                <strong className="text-slate-900 font-mono">.psa</strong> — JDA Space Planning
                compatible interchange (tab-delimited).
              </li>
              <li>
                <strong className="text-slate-900">Legacy JSON</strong> — Older{' '}
                <code className="text-xs bg-slate-100 px-1 rounded">layout.racks[]</code> blueprints
                migrate automatically.
              </li>
              <li className="text-slate-500 text-[13px]">
                Export from the rack action bar or Scene &amp; store menu as .psa / .plm.
              </li>
            </ul>
          </section>
        </div>
        </div>
      </div>

      {/* Action bar — always visible below the scroll area */}
      <div className="shrink-0 z-40 border-t border-slate-200/80 bg-white shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={!canImport}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all',
              canImport
                ? 'bg-[#2C5282] text-white shadow-lg shadow-[#2C5282]/30 hover:bg-[#1A365D] hover:scale-[1.01] active:scale-[0.99]'
                : importSucceeded
                  ? 'bg-emerald-100 text-emerald-800 cursor-default'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            {isLoading ? (
              <>
                <Spinner className="h-4 w-4" />
                Importing…
              </>
            ) : importSucceeded ? (
              <>
                <FiCheckCircle size={16} />
                Imported
              </>
            ) : (
              <>
                <FiUpload size={16} />
                Import planogram
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <FiX size={16} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
