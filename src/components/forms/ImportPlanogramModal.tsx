'use client'

import { useRef, useState } from 'react'
import { FiUpload } from 'react-icons/fi'
import { Modal } from '@/components/ui/Modal'
import { Btn } from '@/components/ui/form'
import { Spinner } from '@/components/Spinner'
import { usePlanogramStore } from '@/store/planogramStore'
import { detectPlanogramFormat } from '@/lib/planogram-formats'
import toast from 'react-hot-toast'

const ACCEPT = '.psa,.psm,.plm,.pla,.json,application/json,text/plain'

export function ImportPlanogramModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const importPlanogramFromContent = usePlanogramStore((s) => s.importPlanogramFromContent)
  const loadFromJSON = usePlanogramStore((s) => s.loadFromJSON)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFileName(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const importFile = async (file: File) => {
    setBusy(true)
    setError(null)
    setFileName(file.name)
    try {
      const content = await file.text()
      const format = detectPlanogramFormat(content, file.name)
      if (format === 'unknown') {
        setError('Unrecognized file. Use .plm / .pla, .psa / .psm, or legacy JSON.')
        return
      }
      if (format === 'legacy-json') {
        const parsed = JSON.parse(content)
        await loadFromJSON(parsed)
        toast.success('Imported legacy JSON planogram')
        reset()
        onClose()
        return
      }
      const result = await importPlanogramFromContent(content, file.name)
      if (!result.success) {
        setError(result.message ?? 'Import failed')
        return
      }
        toast.success(
          result.message ??
            `Created ${result.report.racksImported} rack${result.report.racksImported === 1 ? '' : 's'} in this store`,
        )
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) {
          reset()
          onClose()
        }
      }}
      title="Import planogram"
      subtitle="Creates new racks in the selected store from a PLM / PLA or PSA / PSM file."
      maxWidth="md"
      footer={
        <>
          <Btn
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
            disabled={busy}
          >
            Cancel
          </Btn>
          <Btn variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy && <Spinner />}
            {busy ? 'Importing…' : 'Choose file'}
          </Btn>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importFile(file)
        }}
      />
      <button
        type="button"
        disabled={busy}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) void importFile(file)
        }}
        onClick={() => fileRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-[#2C5282]/60 hover:bg-sky-50"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2C5282]/10 text-[#2C5282]">
          <FiUpload size={22} />
        </span>
        <p className="text-sm font-semibold text-slate-800">
          {fileName ?? 'Drop .plm / .pla / .psa / .psm here'}
        </p>
        <p className="text-xs text-slate-500">or click to browse — same files you export from this app</p>
      </button>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </Modal>
  )
}
