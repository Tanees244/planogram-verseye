'use client'

import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
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
    'widthM',
    'depthM',
    'heightM',
  ]
  const lines = [header.join(',')]
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
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
                bin.width,
                bin.depth,
                bin.height,
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
                p.width,
                p.depth,
                p.height,
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
      { header: 'Width m', key: 'width', width: 10 },
      { header: 'Depth m', key: 'depth', width: 10 },
      { header: 'Height m', key: 'height', width: 10 },
    ]
    sheet.getRow(1).font = { bold: true }

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
                width: bin.width,
                depth: bin.depth,
                height: bin.height,
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
                width: p.width,
                depth: p.depth,
                height: p.height,
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

    const shot = captureSceneDataUrl()
    if (shot) {
      try {
        doc.addImage(shot, 'PNG', 14, 32, 260, 115)
      } catch {
        /* canvas may be tainted */
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
    const shot = captureSceneDataUrl()
    if (shot) {
      s1.addImage({ data: shot, x: 0.5, y: 1.55, w: 9, h: 4.0 })
    } else {
      s1.addText('Open the 3D scene before export to include a shelf image.', {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 0.4,
        fontSize: 14,
        color: '999999',
      })
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
 *
 * TODO: When backend documents a dedicated GET /planogram payload shape, prefer that
 * endpoint over shelf detail for idealImageUrl resolution.
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
    const headers: Record<string, string> = { Accept: 'application/json' }
    try {
      const { getPlanogramTokenFromCookie } = await import('@verseye/utils')
      const t = getPlanogramTokenFromCookie()
      if (t) headers.Authorization = `Bearer ${t}`
    } catch {
      /* ignore */
    }

    const res = await fetch(`/api/layout/shelves/${encodeURIComponent(shelfId)}`, {
      headers,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) {
      const msg = json?.message || 'Failed to load planogram'
      toast.error(msg)
      return { success: false, message: msg }
    }
    const data = json?.data ?? json
    const url =
      data?.idealImageUrl ??
      data?.ideal_image_url ??
      data?.planogram?.idealImageUrl ??
      data?.images?.find?.((i: { type?: string; url?: string }) => i?.type === 'ideal')?.url

    if (!url || typeof url !== 'string') {
      const msg = 'No ideal image URL on this planogram'
      toast.error(msg)
      return { success: false, message: msg }
    }

    const imgRes = await fetch(url, {
      headers,
      credentials: 'include',
      cache: 'no-store',
    })
    if (!imgRes.ok) {
      toast.error(`Failed to download ideal image (${imgRes.status})`)
      return { success: false, message: `HTTP ${imgRes.status}` }
    }
    const blob = await imgRes.blob()
    const ct = blob.type || imgRes.headers.get('content-type') || 'image/png'
    const ext = ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png'
    downloadBlob(blob, sanitizeFilename(options?.filename ?? data?.name ?? 'ideal-planogram', ext))
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

  return {
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
      exportScenePng(name ?? selectedStoreName ?? 'planogram-scene')
    },
    exportStorePdf() {
      return exportRacksToPdf(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportRackPdf(rack: Rack) {
      return exportRacksToPdf([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
    },
    exportStorePptx() {
      return exportRacksToPptx(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportRackPptx(rack: Rack) {
      return exportRacksToPptx([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
    },
  }
}
