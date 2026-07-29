'use client'

import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { mToCmDisplay } from '@/utils/lengthUnits'
import {
  downloadTextFile,
  downloadBlob,
  exportPlanogramContent,
  extensionForFormat,
  sanitizeFilename,
  type PlanogramFileFormat,
} from '@/lib/planogram-formats'
import toast from 'react-hot-toast'

export function exportRacksAs(
  racks: Rack[],
  format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>,
  options?: {
    planogramName?: string
    storeId?: string | null
    storeName?: string | null
  },
) {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }

  const content = exportPlanogramContent(racks, format, options)
  const ext = extensionForFormat(format)
  const baseName =
    racks.length === 1
      ? racks[0].blueprintName ?? racks[0].rackCode ?? 'rack'
      : options?.planogramName ?? options?.storeName ?? 'store-planogram'

  downloadTextFile(
    content,
    sanitizeFilename(baseName, ext),
    format === 'plm' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
  )
  toast.success(`Exported ${format.toUpperCase()} file`)
}

/** Flat CSV for Excel — rack / row / bin / SKU / front facings / dims. */
export function exportRacksToCsv(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  const header = [
    'rackCode',
    'sideCode',
    'rowIndex',
    'binName',
    'skuId',
    'skuName',
    'frontFacings',
    'widthCm',
    'depthCm',
    'heightCm',
  ]
  const lines = [header.join(',')]
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const cm = (m: number | null | undefined) =>
    m == null || !Number.isFinite(Number(m)) ? '' : mToCmDisplay(Number(m), 1)
  for (const rack of racks) {
    rack.sides.forEach((side, si) => {
      side.rows.forEach((row, ri) => {
        row.bins.forEach((bin) => {
          if (bin.products.length === 0) {
            lines.push(
              [
                esc(rack.rackCode),
                esc(side.sideCode ?? `S${si + 1}`),
                ri + 1,
                esc(bin.binName),
                '',
                '',
                0,
                cm(bin.width),
                cm(bin.depth),
                cm(bin.height),
              ].join(','),
            )
            return
          }
          for (const p of bin.products) {
            lines.push(
              [
                esc(rack.rackCode),
                esc(side.sideCode ?? `S${si + 1}`),
                ri + 1,
                esc(bin.binName),
                esc(p.id),
                esc(p.name),
                Math.max(1, Math.floor(Number(p.quantity) || 1)),
                cm(p.width),
                cm(p.depth),
                cm(p.height),
              ].join(','),
            )
          }
        })
      })
    })
  }
  downloadTextFile(lines.join('\n'), sanitizeFilename(baseName, 'csv'), 'text/csv;charset=utf-8')
  toast.success('Exported CSV (open in Excel)')
}

/** Native Excel workbook (.xlsx). */
export async function exportRacksToXlsx(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  try {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Aisleris'
    const sheet = wb.addWorksheet('Planogram')
    sheet.columns = [
      { header: 'Rack name', key: 'rackName', width: 22 },
      { header: 'Rack code', key: 'rackCode', width: 14 },
      { header: 'Side', key: 'side', width: 10 },
      { header: 'Row', key: 'row', width: 8 },
      { header: 'Bin', key: 'bin', width: 16 },
      { header: 'SKU id', key: 'skuId', width: 36 },
      { header: 'SKU name', key: 'skuName', width: 28 },
      { header: 'Front facings', key: 'facings', width: 12 },
      { header: 'Width cm', key: 'width', width: 10 },
      { header: 'Depth cm', key: 'depth', width: 10 },
      { header: 'Height cm', key: 'height', width: 10 },
    ]
    sheet.getRow(1).font = { bold: true }
    const cm = (m: number | null | undefined) =>
      m == null || !Number.isFinite(Number(m)) ? '' : mToCmDisplay(Number(m), 1)

    for (const rack of racks) {
      const rackName = rack.blueprintName || rack.rackCode || rack.id
      rack.sides.forEach((side, si) => {
        side.rows.forEach((row, ri) => {
          row.bins.forEach((bin) => {
            if (bin.products.length === 0) {
              sheet.addRow({
                rackName,
                rackCode: rack.rackCode,
                side: side.sideCode ?? `S${si + 1}`,
                row: ri + 1,
                bin: bin.binName || '',
                skuId: '',
                skuName: '',
                facings: 0,
                width: cm(bin.width),
                depth: cm(bin.depth),
                height: cm(bin.height),
              })
              return
            }
            for (const p of bin.products) {
              sheet.addRow({
                rackName,
                rackCode: rack.rackCode,
                side: side.sideCode ?? `S${si + 1}`,
                row: ri + 1,
                bin: bin.binName || '',
                skuId: p.id,
                skuName: p.name,
                facings: Math.max(1, Math.floor(Number(p.quantity) || 1)),
                width: cm(p.width),
                depth: cm(p.depth),
                height: cm(p.height),
              })
            }
          })
        })
      })
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlob(blob, sanitizeFilename(baseName, 'xlsx'))
    toast.success('Exported Excel (.xlsx)')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Excel export failed')
  }
}

/** Capture the main WebGL canvas as PNG. */
export function exportScenePng(baseName = 'planogram-scene') {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas) {
    toast.error('No 3D canvas found to capture')
    return
  }
  try {
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = sanitizeFilename(baseName, 'png')
    a.click()
    toast.success('Exported PNG image')
  } catch {
    toast.error('Could not capture canvas (browser blocked toDataURL)')
  }
}

/** First linked shelf on a rack (planogram / ideal image). */
export function primaryShelfIdForRack(rack: Rack): string | null {
  for (const side of rack.sides ?? []) {
    const id = side.shelfId?.trim()
    if (id) return id
  }
  return null
}

async function exportAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  try {
    const { getPlanogramTokenFromCookie } = await import('@verseye/utils')
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

function storageKeyFromSignedUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const key = parts.slice(1).join('/')
    return key && !key.includes('..') ? key : null
  } catch {
    return null
  }
}

/** Same-origin proxy URL for ideal image fetch (avoids CORS / expired signatures). */
function proxiedIdealFetchUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) {
    const key = storageKeyFromSignedUrl(trimmed)
    if (key) return `/api/files/image?key=${encodeURIComponent(key)}`
    return `/api/files/image?url=${encodeURIComponent(trimmed)}`
  }
  return `/api/files/image?key=${encodeURIComponent(trimmed)}`
}

function pickIdealImageRef(data: Record<string, unknown>): string | null {
  const planogram =
    data.planogram && typeof data.planogram === 'object'
      ? (data.planogram as Record<string, unknown>)
      : null
  const images = Array.isArray(data.images) ? data.images : []
  const fromImages = images.find(
    (i) =>
      i &&
      typeof i === 'object' &&
      (i as { type?: string }).type === 'ideal' &&
      typeof (i as { url?: string }).url === 'string',
  ) as { url?: string; storageKey?: string } | undefined

  const candidates = [
    data.idealImageUrl,
    data.ideal_image_url,
    data.idealImageStorageKey,
    data.ideal_image_storage_key,
    planogram?.idealImageUrl,
    planogram?.idealImageStorageKey,
    fromImages?.url,
    fromImages?.storageKey,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  if (/^data:image\/jpe?g/i.test(dataUrl)) return 'JPEG'
  return 'PNG'
}

/**
 * Load shelf ideal planogram image as a data URL for PNG / PDF / PPTX embeds.
 * Returns null when the shelf has no ideal image (caller may fall back to scene).
 */
export async function fetchIdealImageDataUrl(
  shelfId: string,
): Promise<{ dataUrl: string; filenameBase: string } | null> {
  if (!shelfId) return null
  try {
    const headers = await exportAuthHeaders()
    const res = await fetch(`/api/layout/shelves/${encodeURIComponent(shelfId)}`, {
      headers,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) return null
    const data = (json?.data ?? json) as Record<string, unknown>
    const ref = pickIdealImageRef(data)
    if (!ref) return null

    const imgRes = await fetch(proxiedIdealFetchUrl(ref), {
      headers,
      credentials: 'include',
      cache: 'no-store',
    })
    if (!imgRes.ok) return null
    const blob = await imgRes.blob()
    const dataUrl = await blobToDataUrl(blob)
    const name =
      (typeof data.name === 'string' && data.name) ||
      (typeof data.planogramName === 'string' && data.planogramName) ||
      'ideal-planogram'
    return { dataUrl, filenameBase: name }
  } catch {
    return null
  }
}

/** Prefer ideal planogram image for a rack; fall back to 3D scene capture. */
async function resolveExportImageDataUrl(
  racks: Rack[],
): Promise<{ dataUrl: string; source: 'ideal' | 'scene' } | null> {
  if (racks.length === 1) {
    const shelfId = primaryShelfIdForRack(racks[0])
    if (shelfId) {
      const ideal = await fetchIdealImageDataUrl(shelfId)
      if (ideal) return { dataUrl: ideal.dataUrl, source: 'ideal' }
    }
  }
  const shot = captureSceneDataUrl()
  return shot ? { dataUrl: shot, source: 'scene' } : null
}

/** PNG: ideal planogram image when the rack has one; otherwise scene capture. */
export async function exportRackPng(rack: Rack, baseName?: string) {
  const shelfId = primaryShelfIdForRack(rack)
  const name =
    baseName ?? rack.blueprintName ?? rack.rackCode ?? rack.rackName ?? 'rack'
  if (shelfId) {
    const ideal = await fetchIdealImageDataUrl(shelfId)
    if (ideal) {
      const fmt = imageFormatFromDataUrl(ideal.dataUrl)
      const ext = fmt === 'JPEG' ? 'jpg' : 'png'
      const a = document.createElement('a')
      a.href = ideal.dataUrl
      a.download = sanitizeFilename(name, ext)
      a.click()
      toast.success('Exported ideal planogram PNG')
      return
    }
    toast('No ideal image — exporting 3D scene capture instead', { icon: 'ℹ️' })
  }
  exportScenePng(name)
}

function flattenRows(racks: Rack[]) {
  const rows: Array<{
    rack: string
    side: string
    row: number
    bin: string
    sku: string
    qty: number
  }> = []
  for (const rack of racks) {
    rack.sides.forEach((side, si) => {
      side.rows.forEach((row, ri) => {
        row.bins.forEach((bin) => {
          if (!bin.products.length) {
            rows.push({
              rack: rack.blueprintName || rack.rackCode || rack.id,
              side: side.sideCode || `S${si + 1}`,
              row: ri + 1,
              bin: bin.binName || 'Bin',
              sku: '—',
              qty: 0,
            })
            return
          }
          for (const p of bin.products) {
            rows.push({
              rack: rack.blueprintName || rack.rackCode || rack.id,
              side: side.sideCode || `S${si + 1}`,
              row: ri + 1,
              bin: bin.binName || 'Bin',
              sku: p.name,
              qty: Math.max(1, Math.floor(Number(p.quantity) || 1)),
            })
          }
        })
      })
    })
  }
  return rows
}

function captureSceneDataUrl(): string | null {
  try {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    return canvas?.toDataURL('image/png') ?? null
  } catch {
    return null
  }
}

/** Multi-page PDF: optional scene shot + SKU listing. */
export async function exportRacksToPdf(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  try {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const title =
      racks.length === 1
        ? racks[0].blueprintName || racks[0].rackCode || 'Planogram'
        : baseName

    doc.setFontSize(16)
    doc.text(String(title), 14, 16)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Exported ${new Date().toLocaleString()}`, 14, 22)
    try {
      const { rackFaceUtilization } = await import('@/utils/faceFill')
      const totals = racks.reduce(
        (acc, r) => {
          const u = rackFaceUtilization(r)
          return {
            occupiedM: acc.occupiedM + u.occupiedM,
            availableM: acc.availableM + u.availableM,
          }
        },
        { occupiedM: 0, availableM: 0 },
      )
      const pct =
        totals.availableM > 0
          ? Math.round((totals.occupiedM / totals.availableM) * 100)
          : 0
      doc.text(
        `Face utilization: ${pct}% (${totals.occupiedM.toFixed(2)} / ${totals.availableM.toFixed(2)} m)`,
        14,
        27,
      )
    } catch {
      /* ignore */
    }
    doc.setTextColor(0)

    const image = await resolveExportImageDataUrl(racks)
    if (image) {
      try {
        doc.addImage(image.dataUrl, imageFormatFromDataUrl(image.dataUrl), 14, 32, 260, 115)
      } catch {
        /* canvas may be tainted / unsupported format */
      }
    }

    doc.addPage()
    doc.setFontSize(14)
    doc.text('SKU listing (front facings)', 14, 16)
    doc.setFontSize(9)
    let y = 24
    const lines = flattenRows(racks)
    doc.text('Rack | Side | Row | Bin | SKU | Facings', 14, y)
    y += 6
    for (const r of lines.slice(0, 80)) {
      const line = `${r.rack} | ${r.side} | ${r.row} | ${r.bin} | ${r.sku} | ${r.qty}`
      doc.text(line.slice(0, 110), 14, y)
      y += 5
      if (y > 190) {
        doc.addPage()
        y = 16
      }
    }
    if (lines.length > 80) {
      doc.text(`…and ${lines.length - 80} more rows (see CSV for full list)`, 14, y + 4)
    }

    doc.save(sanitizeFilename(baseName, 'pdf'))
    toast.success('Exported PDF')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'PDF export failed')
  }
}

/** PowerPoint deck: title + scene image + SKU table slide. */
export async function exportRacksToPptx(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  try {
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()
    const title =
      racks.length === 1
        ? racks[0].blueprintName || racks[0].rackCode || 'Planogram'
        : baseName

    const s1 = pptx.addSlide()
    s1.addText(String(title), { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 24, bold: true })
    s1.addText(`Exported ${new Date().toLocaleString()}`, {
      x: 0.5,
      y: 0.95,
      w: 9,
      h: 0.3,
      fontSize: 12,
      color: '666666',
    })
    try {
      const { rackFaceUtilization } = await import('@/utils/faceFill')
      const totals = racks.reduce(
        (acc, r) => {
          const u = rackFaceUtilization(r)
          return {
            occupiedM: acc.occupiedM + u.occupiedM,
            availableM: acc.availableM + u.availableM,
          }
        },
        { occupiedM: 0, availableM: 0 },
      )
      const pct =
        totals.availableM > 0
          ? Math.round((totals.occupiedM / totals.availableM) * 100)
          : 0
      s1.addText(
        `Face utilization: ${pct}% (${totals.occupiedM.toFixed(2)} / ${totals.availableM.toFixed(2)} m linear front)`,
        {
          x: 0.5,
          y: 1.2,
          w: 9,
          h: 0.25,
          fontSize: 12,
          color: '2C5282',
        },
      )
    } catch {
      /* ignore */
    }
    const image = await resolveExportImageDataUrl(racks)
    if (image) {
      s1.addImage({ data: image.dataUrl, x: 0.5, y: 1.55, w: 9, h: 4.0 })
      if (image.source === 'ideal') {
        s1.addText('Ideal planogram image', {
          x: 0.5,
          y: 5.6,
          w: 9,
          h: 0.25,
          fontSize: 10,
          color: '666666',
        })
      }
    } else {
      s1.addText(
        racks.length === 1
          ? 'No ideal planogram image — Save as planogram, or open the 3D scene to capture.'
          : 'Open the 3D scene before export to include a shelf image.',
        {
          x: 0.5,
          y: 2.5,
          w: 9,
          h: 0.4,
          fontSize: 14,
          color: '999999',
        },
      )
    }

    const s2 = pptx.addSlide()
    s2.addText('SKU listing', { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 18, bold: true })
    const tableRows = [
      [
        { text: 'Rack', options: { bold: true } },
        { text: 'Side', options: { bold: true } },
        { text: 'Row', options: { bold: true } },
        { text: 'Bin', options: { bold: true } },
        { text: 'SKU', options: { bold: true } },
        { text: 'Facings', options: { bold: true } },
      ],
      ...flattenRows(racks)
        .slice(0, 40)
        .map((r) => [
          r.rack,
          r.side,
          String(r.row),
          r.bin,
          r.sku,
          String(r.qty),
        ]),
    ]
    s2.addTable(tableRows as any, {
      x: 0.4,
      y: 0.9,
      w: 9.2,
      colW: [2, 1, 0.8, 1.4, 2.6, 1],
      fontSize: 10,
      border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
    })

    // Use blob output — writeFile() probes process.versions.node and can pull node:fs.
    const blob = (await pptx.write({ outputType: 'blob' })) as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = sanitizeFilename(baseName, 'pptx')
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported PowerPoint')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'PowerPoint export failed')
  }
}

/**
 * Download the shelf planogram ideal image (PNG/JPEG) when the API exposes idealImageUrl.
 * Falls back gracefully if the field is missing.
 */
export async function downloadIdealImageFromShelf(
  shelfId: string,
  options?: { filename?: string },
): Promise<{ success: boolean; message?: string }> {
  if (!shelfId) {
    toast.error('No shelf id')
    return { success: false, message: 'No shelf id' }
  }
  try {
    const ideal = await fetchIdealImageDataUrl(shelfId)
    if (!ideal) {
      const msg = 'No ideal image URL on this planogram'
      toast.error(msg)
      return { success: false, message: msg }
    }
    const fmt = imageFormatFromDataUrl(ideal.dataUrl)
    const ext = fmt === 'JPEG' ? 'jpg' : 'png'
    const a = document.createElement('a')
    a.href = ideal.dataUrl
    a.download = sanitizeFilename(options?.filename ?? ideal.filenameBase, ext)
    a.click()
    toast.success('Downloaded ideal image')
    return { success: true }
  } catch {
    toast.error('Network error downloading ideal image')
    return { success: false, message: 'Network error' }
  }
}

export function usePlanogramExport() {
  const area = usePlanogramStore((s) => s.area)
  const selectedStoreId = usePlanogramStore((s) => s.selectedStoreId)
  const selectedStoreName = usePlanogramStore((s) => s.selectedStoreName)
  const selectedId = usePlanogramStore((s) => s.selectedId)
  const selectedType = usePlanogramStore((s) => s.selectedType)

  const getSelectedRack = (): Rack | null => {
    if (selectedType !== 'rack' || !selectedId) return null
    return (
      area.racks.find((r) => r.id === selectedId || r.rackId === selectedId) ?? null
    )
  }

  return {
    /** True when a rack is selected — PNG / PDF / PowerPoint use that rack + ideal image. */
    hasSelectedRack: selectedType === 'rack' && Boolean(selectedId),
    exportStore(format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>) {
      exportRacksAs(area.racks, format, {
        planogramName: selectedStoreName ?? 'Store planogram',
        storeId: selectedStoreId,
        storeName: selectedStoreName,
      })
    },
    exportRack(
      rack: Rack,
      format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>,
    ) {
      exportRacksAs([rack], format, {
        planogramName: rack.blueprintName ?? rack.rackCode,
        storeId: selectedStoreId,
        storeName: selectedStoreName,
      })
    },
    exportStoreCsv() {
      exportRacksToCsv(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportRackCsv(rack: Rack) {
      exportRacksToCsv([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
    },
    exportStoreXlsx() {
      return exportRacksToXlsx(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportRackXlsx(rack: Rack) {
      return exportRacksToXlsx([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
    },
    exportSceneImage(name?: string) {
      const rack = getSelectedRack()
      if (rack) {
        void exportRackPng(rack, name)
        return
      }
      exportScenePng(name ?? selectedStoreName ?? 'planogram-scene')
    },
    exportStorePdf() {
      const rack = getSelectedRack()
      if (rack) {
        return exportRacksToPdf([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
      }
      return exportRacksToPdf(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportRackPdf(rack: Rack) {
      return exportRacksToPdf([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
    },
    exportStorePptx() {
      const rack = getSelectedRack()
      if (rack) {
        return exportRacksToPptx([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
      }
      return exportRacksToPptx(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportRackPptx(rack: Rack) {
      return exportRacksToPptx([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
    },
  }
}
