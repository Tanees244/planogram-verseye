'use client'

import type { Rack } from '@/store/planogramStore'
import { usePlanogramStore } from '@/store/planogramStore'
import { mToCmDisplay, formatCm } from '@/utils/lengthUnits'
import { clampRowSpanToInner } from '@/utils/rackBlueprintMapper'
import { normalizeRack } from '@/utils/storeLayoutLoader'
import {
  buildStructureOutline,
  collectIdealImageRefs,
  extractStructureDrawSides,
  fetchRackStructurePayload,
  flattenStructureDetails,
  serverRackIdOf,
  type StructureDrawSide,
  type StructureExportRow,
  type StructureOutlineItem,
  type StructurePayload,
} from '@/utils/structureExport'
import {
  downloadTextFile,
  downloadBlob,
  exportPlanogramContent,
  extensionForFormat,
  sanitizeFilename,
  type PlanogramFileFormat,
} from '@/lib/planogram-formats'
import toast from 'react-hot-toast'
import { captureRackOnlyPng } from '@/utils/captureRackScene'

async function loadStructureExports(racks: Rack[]): Promise<{
  payloads: StructurePayload[]
  racks: Rack[]
}> {
  const payloads: StructurePayload[] = []
  const next: Rack[] = []
  for (const rack of racks) {
    const id = serverRackIdOf(rack)
    if (!id) {
      next.push(rack)
      continue
    }
    const res = await fetchRackStructurePayload(id)
    if (res.success && res.data) {
      payloads.push(res.data)
      next.push(normalizeRack(res.data))
    } else {
      if (res.message) toast.error(res.message)
      next.push(rack)
    }
  }
  return { payloads, racks: next }
}

export async function exportRacksAs(
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

  const loaded = await loadStructureExports(racks)
  const content = exportPlanogramContent(loaded.racks, format, options)
  const ext = extensionForFormat(format)
  const baseName =
    loaded.racks.length === 1
      ? String(
          loaded.payloads[0]?.rackName ||
            loaded.payloads[0]?.rackCode ||
            loaded.racks[0].blueprintName ||
            loaded.racks[0].rackCode ||
            'rack',
        )
      : options?.planogramName ?? options?.storeName ?? 'store-planogram'

  downloadTextFile(
    content,
    sanitizeFilename(baseName, ext),
    format === 'plm' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
  )
  toast.success(`Exported ${format.toUpperCase()} from rack structure`)
}

export async function exportRacksStructureJson(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  const loaded = await loadStructureExports(racks)
  if (loaded.payloads.length === 0) {
    toast.error('No server structure to export — save this rack to the store first')
    return
  }
  const body = loaded.payloads.length === 1 ? loaded.payloads[0] : loaded.payloads
  const name =
    loaded.payloads.length === 1
      ? String(loaded.payloads[0].rackName || loaded.payloads[0].rackCode || baseName)
      : baseName
  downloadTextFile(
    JSON.stringify(body, null, 2),
    sanitizeFilename(String(name), 'json'),
    'application/json;charset=utf-8',
  )
  toast.success('Exported rack structure JSON')
}

function csvEsc(v: string | number | null | undefined) {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function structureRowToCsv(row: StructureExportRow) {
  return [
    row.rackCode,
    row.rackName,
    row.fixtureType,
    row.sideCode,
    row.shelfName,
    row.rowNumber,
    row.binName,
    row.skuCode,
    row.skuName,
    row.quantity,
    row.faceFacings,
    row.unitsDeep,
    row.verticalLayers,
    row.binWidthM,
    row.binDepthM,
    row.binHeightM,
    row.utilizationPct,
    row.idealImageUrl,
  ]
    .map(csvEsc)
    .join(',')
}

export async function exportRacksToCsv(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  const loaded = await loadStructureExports(racks)
  const header = [
    'rackCode',
    'rackName',
    'fixtureType',
    'sideCode',
    'shelfName',
    'rowNumber',
    'binName',
    'skuCode',
    'skuName',
    'quantity',
    'faceFacings',
    'unitsDeep',
    'verticalLayers',
    'binWidthM',
    'binDepthM',
    'binHeightM',
    'utilizationPct',
    'idealImageUrl',
  ]
  const lines = [header.join(',')]
  if (loaded.payloads.length > 0) {
    for (const payload of loaded.payloads) {
      for (const row of flattenStructureDetails(payload)) {
        lines.push(structureRowToCsv(row))
      }
    }
  } else {
    const cm = (m: number | null | undefined) =>
      m == null || !Number.isFinite(Number(m)) ? '' : mToCmDisplay(Number(m), 1)
    for (const rack of loaded.racks) {
      rack.sides.forEach((side, si) => {
        side.rows.forEach((row, ri) => {
          row.bins.forEach((bin) => {
            if (bin.products.length === 0) {
              lines.push(
                [
                  csvEsc(rack.rackCode),
                  csvEsc(rack.blueprintName),
                  '',
                  csvEsc(side.sideCode ?? `S${si + 1}`),
                  '',
                  ri + 1,
                  csvEsc(bin.binName),
                  '',
                  '',
                  0,
                  '',
                  '',
                  '',
                  cm(bin.width),
                  cm(bin.depth),
                  cm(bin.height),
                  '',
                  '',
                ].join(','),
              )
              return
            }
            for (const p of bin.products) {
              lines.push(
                [
                  csvEsc(rack.rackCode),
                  csvEsc(rack.blueprintName),
                  '',
                  csvEsc(side.sideCode ?? `S${si + 1}`),
                  '',
                  ri + 1,
                  csvEsc(bin.binName),
                  csvEsc(p.id),
                  csvEsc(p.name),
                  Math.max(1, Math.floor(Number(p.quantity) || 1)),
                  '',
                  '',
                  '',
                  cm(p.width),
                  cm(p.depth),
                  cm(p.height),
                  '',
                  '',
                ].join(','),
              )
            }
          })
        })
      })
    }
  }
  downloadTextFile(lines.join('\n'), sanitizeFilename(baseName, 'csv'), 'text/csv;charset=utf-8')
  toast.success('Exported CSV from rack structure')
}

export async function exportRacksToXlsx(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  try {
    const loaded = await loadStructureExports(racks)
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Aisleris'
    const detail = wb.addWorksheet('Planogram')
    detail.columns = [
      { header: 'Rack name', key: 'rackName', width: 22 },
      { header: 'Rack code', key: 'rackCode', width: 14 },
      { header: 'Fixture', key: 'fixtureType', width: 12 },
      { header: 'Side', key: 'sideCode', width: 8 },
      { header: 'Shelf / planogram', key: 'shelfName', width: 22 },
      { header: 'Row', key: 'rowNumber', width: 8 },
      { header: 'Bin', key: 'binName', width: 22 },
      { header: 'SKU code', key: 'skuCode', width: 16 },
      { header: 'SKU name', key: 'skuName', width: 28 },
      { header: 'Qty', key: 'quantity', width: 8 },
      { header: 'Face facings', key: 'faceFacings', width: 12 },
      { header: 'Units deep', key: 'unitsDeep', width: 11 },
      { header: 'Stack layers', key: 'verticalLayers', width: 12 },
      { header: 'Bin W m', key: 'binWidthM', width: 10 },
      { header: 'Bin D m', key: 'binDepthM', width: 10 },
      { header: 'Bin H m', key: 'binHeightM', width: 10 },
      { header: 'Row util %', key: 'utilizationPct', width: 11 },
      { header: 'POSM', key: 'posmName', width: 18 },
    ]
    detail.getRow(1).font = { bold: true }

    const summary = wb.addWorksheet('Summary')
    summary.columns = [
      { header: 'Field', key: 'field', width: 28 },
      { header: 'Value', key: 'value', width: 48 },
    ]
    summary.getRow(1).font = { bold: true }

    if (loaded.payloads.length > 0) {
      for (const payload of loaded.payloads) {
        const outer =
          payload.outer && typeof payload.outer === 'object'
            ? (payload.outer as Record<string, unknown>)
            : {}
        const inner =
          payload.inner && typeof payload.inner === 'object'
            ? (payload.inner as Record<string, unknown>)
            : {}
        summary.addRow({ field: 'Rack name', value: String(payload.rackName ?? '') })
        summary.addRow({ field: 'Rack code', value: String(payload.rackCode ?? '') })
        summary.addRow({ field: 'Rack id', value: String(payload.rackId ?? '') })
        summary.addRow({ field: 'Fixture', value: String(payload.fixtureType ?? '') })
        summary.addRow({
          field: 'Outer W×D×H m',
          value: `${outer.width ?? payload.width ?? ''} × ${outer.depth ?? payload.depth ?? ''} × ${outer.height ?? payload.height ?? ''}`,
        })
        summary.addRow({
          field: 'Usable inner W×D×H m',
          value: `${inner.width ?? ''} × ${inner.depth ?? ''} × ${inner.height ?? ''}`,
        })
        summary.addRow({ field: 'Last updated', value: String(payload.lastUpdated ?? '') })
        summary.addRow({ field: 'Published at', value: String(payload.publishedAt ?? '') })
        summary.addRow({ field: '', value: '' })

        for (const row of flattenStructureDetails(payload)) {
          detail.addRow(row)
        }
      }

      const outlineSheet = wb.addWorksheet('Structure')
      outlineSheet.columns = [
        { header: 'Level', key: 'kind', width: 10 },
        { header: 'Name', key: 'title', width: 48 },
        { header: 'Details', key: 'detail', width: 70 },
      ]
      outlineSheet.getRow(1).font = { bold: true }
      for (const payload of loaded.payloads) {
        for (const item of buildStructureOutline(payload)) {
          outlineSheet.addRow({
            kind: item.kind,
            title: `${'  '.repeat(item.indent)}${item.title}`,
            detail: item.detail,
          })
        }
      }

      const ideal = await fetchIdealImageFromPayloads(loaded.payloads)
      if (ideal) {
        const imgSheet = wb.addWorksheet('Ideal image')
        const ext = imageFormatFromDataUrl(ideal.dataUrl) === 'JPEG' ? 'jpeg' : 'png'
        const base64 = ideal.dataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
        const imageId = wb.addImage({ base64, extension: ext })
        imgSheet.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 960, height: 540 },
        })
      }
    } else {
      const cm = (m: number | null | undefined) =>
        m == null || !Number.isFinite(Number(m)) ? '' : mToCmDisplay(Number(m), 1)
      for (const rack of loaded.racks) {
        const rackName = rack.blueprintName || rack.rackCode || rack.id
        rack.sides.forEach((side, si) => {
          side.rows.forEach((row, ri) => {
            row.bins.forEach((bin) => {
              if (bin.products.length === 0) {
                detail.addRow({
                  rackName,
                  rackCode: rack.rackCode,
                  sideCode: side.sideCode ?? `S${si + 1}`,
                  rowNumber: ri + 1,
                  binName: bin.binName || '',
                  quantity: 0,
                  binWidthM: cm(bin.width),
                  binDepthM: cm(bin.depth),
                  binHeightM: cm(bin.height),
                })
                return
              }
              for (const p of bin.products) {
                detail.addRow({
                  rackName,
                  rackCode: rack.rackCode,
                  sideCode: side.sideCode ?? `S${si + 1}`,
                  rowNumber: ri + 1,
                  binName: bin.binName || '',
                  skuCode: p.id,
                  skuName: p.name,
                  quantity: Math.max(1, Math.floor(Number(p.quantity) || 1)),
                  skuWidthM: cm(p.width),
                  skuDepthM: cm(p.depth),
                  skuHeightM: cm(p.height),
                })
              }
            })
          })
        })
      }
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlob(blob, sanitizeFilename(baseName, 'xlsx'))
    toast.success('Exported Excel from rack structure')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Excel export failed')
  }
}

/** Capture the isolated rack (no warehouse) as a PNG File. */
export function captureScenePngFile(baseName = 'planogram-snapshot'): File | null {
  try {
    const url = captureRackOnlyPng()
    if (!url) return null
    const raw = url.split(',')[1]
    if (!raw) return null
    const bytes = atob(raw)
    const buf = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
    const safe = baseName.replace(/[^\w.-]+/g, '-').slice(0, 80) || 'planogram-snapshot'
    return new File([buf], `${safe}.png`, { type: 'image/png' })
  } catch {
    return null
  }
}

/** Capture the isolated rack as PNG (warehouse / floor cropped out). */
export function exportScenePng(baseName = 'planogram-scene') {
  try {
    const url = captureRackOnlyPng()
    if (!url) {
      toast.error('Open the 3D scene and select a rack first')
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = sanitizeFilename(baseName, 'png')
    a.click()
    toast.success('Exported 3D rack screenshot')
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

async function fetchImageAsDataUrl(ref: string): Promise<string | null> {
  try {
    const headers = await exportAuthHeaders()
    const imgRes = await fetch(proxiedIdealFetchUrl(ref), {
      headers,
      credentials: 'include',
      cache: 'no-store',
    })
    if (!imgRes.ok) return null
    const blob = await imgRes.blob()
    if (!blob.size || !blob.type.startsWith('image/')) return null
    return blobToDataUrl(blob)
  } catch {
    return null
  }
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
    const dataUrl = await fetchImageAsDataUrl(ref)
    if (!dataUrl) return null
    const name =
      (typeof data.name === 'string' && data.name) ||
      (typeof data.planogramName === 'string' && data.planogramName) ||
      'ideal-planogram'
    return { dataUrl, filenameBase: name }
  } catch {
    return null
  }
}

/** Prefer structure.shelf.idealImageUrl, then GET shelf detail. */
export async function fetchIdealImageFromPayloads(
  payloads: StructurePayload[],
): Promise<{ dataUrl: string; filenameBase: string } | null> {
  for (const data of payloads) {
    const refs = collectIdealImageRefs(data)
    for (const ref of refs) {
      if (ref.url) {
        const dataUrl = await fetchImageAsDataUrl(ref.url)
        if (dataUrl) return { dataUrl, filenameBase: ref.name || 'ideal-planogram' }
      }
      if (ref.shelfId) {
        const fromShelf = await fetchIdealImageDataUrl(ref.shelfId)
        if (fromShelf) return fromShelf
      }
    }
  }
  return null
}

/** Prefer working-area elevation of the rack; never the 3D scene with side frames. */
async function resolveExportImageDataUrl(
  racks: Rack[],
  payloads?: StructurePayload[],
): Promise<{ dataUrl: string; source: 'ideal' | 'scene' } | null> {
  const sides = workingElevationSides(racks, payloads)
  const drawn = sides[0] ? drawStructureElevationCanvas(sides[0]) : null
  if (drawn) return { dataUrl: drawn, source: 'scene' }
  return null
}

/** PNG: working shelf area with dimensions (no side frames / 3D scene). */
export async function exportRackPng(rack: Rack, baseName?: string) {
  const loaded = await loadStructureExports([rack])
  const name =
    baseName ??
    String(
      loaded.payloads[0]?.rackName ||
        loaded.payloads[0]?.rackCode ||
        rack.blueprintName ||
        rack.rackCode ||
        rack.rackName ||
        'rack',
    )
  const sides = workingElevationSides(loaded.racks.length ? loaded.racks : [rack], loaded.payloads)
  const png = sides[0] ? drawStructureElevationCanvas(sides[0]) : null
  if (png) {
    const a = document.createElement('a')
    a.href = png
    a.download = sanitizeFilename(name, 'png')
    a.click()
    toast.success('Exported working shelf view (dimensions only)')
    return
  }
  toast.error('This rack has no shelves to export')
}

function flattenRows(racks: Rack[], payloads?: StructurePayload[]) {
  if (payloads && payloads.length > 0) {
    return payloads.flatMap(flattenStructureDetails).map((r) => ({
      rack: r.rackName || r.rackCode,
      side: r.sideCode,
      row: r.rowNumber === '' ? 0 : r.rowNumber,
      bin: r.binName || 'Bin',
      sku: r.skuName || '—',
      qty: r.quantity === '' ? 0 : r.quantity,
    }))
  }
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

function extractLiveRackDrawSides(rack: Rack): StructureDrawSide[] {
  return rack.sides.map((side, si) => {
    const usableWidth = clampRowSpanToInner(rack, side.rows[0]?.width ?? rack.inner?.width)
    const hasY = side.rows.some((r) => Number.isFinite(Number(r.yStart)))
    const ordered = hasY
      ? [...side.rows].sort((a, b) => Number(b.yStart) - Number(a.yStart))
      : [...side.rows].reverse()
    const rows = ordered.map((row) => {
      const rowW =
        Number(row.width ?? row.span) > 0
          ? Number(row.width ?? row.span)
          : usableWidth
      let xLeft = 0
      let xRight = rowW
      const bins = row.bins.map((bin) => {
        const w = Number(bin.width) || 0
        let xStart: number
        if (bin.anchor === 'right') {
          xRight -= w
          xStart = Math.max(0, xRight)
        } else {
          xStart = xLeft
          xLeft += w
        }
        const p = bin.products[0]
        const qty = p ? Math.max(1, Math.floor(Number(p.quantity) || 1)) : 0
        const skuW = Number(p?.width) || 0
        const faces =
          p && skuW > 0
            ? Math.max(1, Math.min(qty, Math.max(1, Math.floor(w / skuW + 1e-6) || qty)))
            : qty
        return {
          name: bin.binName || p?.name || (p ? 'SKU' : 'Empty'),
          skuName: p?.name || '',
          skuCode: '',
          xStart,
          width: w,
          faceFacings: faces,
          quantity: qty,
          empty: !p,
          color: p?.color,
        }
      })
      const orig = side.rows.indexOf(row)
      return {
        rowNumber: orig >= 0 ? orig + 1 : 1,
        width: rowW,
        height: Number(row.height) || 0,
        utilizationPct: 0,
        bins,
      }
    })
    return {
      sideCode: side.sideCode || `S${si + 1}`,
      shelfName: String(rack.displayName || rack.blueprintName || rack.rackCode || ''),
      usableWidth,
      rows,
    }
  })
}

function workingElevationSides(racks: Rack[], payloads?: StructurePayload[]): StructureDrawSide[] {
  const live = racks.flatMap(extractLiveRackDrawSides).filter((s) => s.rows.length > 0)
  if (live.some((s) => s.rows.some((r) => r.bins.length > 0 || r.height > 0))) return live
  if (payloads?.length) return payloads.flatMap(extractStructureDrawSides)
  return live
}

/** Front working cavity only — shelves, SKUs, and dimensions. No side frames. */
function drawStructureElevationCanvas(side: StructureDrawSide): string | null {
  if (typeof document === 'undefined') return null
  const w = 1600
  const h = 1000
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  const leftDim = 96
  const rightPad = 28
  const topPad = 56
  const botDim = 72
  const bayX = leftDim
  const bayY = topPad
  const bayW = w - leftDim - rightPad
  const bayH = h - topPad - botDim
  const span = side.usableWidth > 0 ? side.usableWidth : 1
  const rows = side.rows.length ? side.rows : []
  const totalH = rows.reduce((s, r) => s + Math.max(Number(r.height) || 0.25, 0.15), 0) || 1

  ctx.fillStyle = '#0f172a'
  ctx.font = '600 26px sans-serif'
  const title = [side.shelfName, side.sideCode].filter(Boolean).join('  ·  ') || 'Working shelf'
  ctx.fillText(title, bayX, 34)
  const titleW = ctx.measureText(title).width
  ctx.font = '16px sans-serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('Working area  ·  dimensions only  ·  no side frames', bayX + titleW + 16, 34)

  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(bayX, bayY, bayW, bayH)
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.strokeRect(bayX + 0.5, bayY + 0.5, bayW - 1, bayH - 1)

  let y = bayY
  rows.forEach((row) => {
    const rowPx = (Math.max(Number(row.height) || 0.25, 0.15) / totalH) * bayH
    const board = 8
    const cavityH = Math.max(12, rowPx - board)
    const cavityY = y
    const shelfY = y + cavityH

    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(bayX, cavityY, bayW, cavityH)
    ctx.fillStyle = '#94a3b8'
    ctx.fillRect(bayX, shelfY, bayW, board)

    const rowSpan = row.width > 0 ? row.width : span
    if (row.bins.length === 0) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '18px sans-serif'
      ctx.fillText('Empty', bayX + 12, cavityY + cavityH / 2 + 6)
    } else {
      for (const bin of row.bins) {
        const bx = bayX + (Math.max(0, bin.xStart) / rowSpan) * bayW
        const bw = Math.max(8, (Math.max(bin.width, 0.05) / rowSpan) * bayW)
        if (bin.empty) continue
        const faces = Math.max(1, Math.min(bin.faceFacings || bin.quantity || 1, 80))
        const fw = bw / faces
        const fh = Math.max(10, cavityH - 6)
        const fill = bin.color || '#64748b'
        for (let f = 0; f < faces; f++) {
          const fx = bx + f * fw + 1
          ctx.fillStyle = fill
          ctx.fillRect(fx, cavityY + cavityH - fh - 2, Math.max(2, fw - 2), fh)
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1
          ctx.strokeRect(fx, cavityY + cavityH - fh - 2, Math.max(2, fw - 2), fh)
        }
      }
    }

    ctx.fillStyle = '#334155'
    ctx.font = '600 14px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`R${row.rowNumber}`, bayX - 10, cavityY + 16)
    ctx.font = '13px sans-serif'
    ctx.fillText(formatCm(row.height, 0), bayX - 10, cavityY + cavityH / 2 + 4)
    ctx.textAlign = 'left'

    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(bayX - 28, cavityY + 4)
    ctx.lineTo(bayX - 28, shelfY)
    ctx.moveTo(bayX - 34, cavityY + 4)
    ctx.lineTo(bayX - 22, cavityY + 4)
    ctx.moveTo(bayX - 34, shelfY)
    ctx.lineTo(bayX - 22, shelfY)
    ctx.stroke()

    y += rowPx
  })

  const dimY = bayY + bayH + 36
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(bayX, dimY)
  ctx.lineTo(bayX + bayW, dimY)
  ctx.moveTo(bayX, dimY - 8)
  ctx.lineTo(bayX, dimY + 8)
  ctx.moveTo(bayX + bayW, dimY - 8)
  ctx.lineTo(bayX + bayW, dimY + 8)
  ctx.stroke()
  ctx.fillStyle = '#0f172a'
  ctx.font = '600 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(formatCm(span, 0), bayX + bayW / 2, dimY - 10)
  ctx.font = '13px sans-serif'
  ctx.fillStyle = '#64748b'
  ctx.fillText('usable width', bayX + bayW / 2, dimY + 18)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function clipCanvasText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1)
  return `${t}…`
}

function drawStructureElevationPdf(
  doc: {
    setFont: (font: string, style: string) => void
    setFontSize: (n: number) => void
    setTextColor: (...n: number[]) => void
    text: (t: string, x: number, y: number, opts?: { maxWidth?: number }) => void
    addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void
    addPage: () => void
  },
  racks: Rack[],
  payloads: StructurePayload[],
) {
  const sides = workingElevationSides(racks, payloads)
  if (sides.length === 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('No working shelves to export', 14, 20)
    return
  }
  sides.forEach((side, idx) => {
    if (idx > 0) doc.addPage()
    const png = drawStructureElevationCanvas(side)
    if (png) {
      doc.addImage(png, 'PNG', 10, 8, 277, 155)
    } else {
      drawStructureOutlinePdf(doc, payloads, [])
    }
  })
}

function drawStructureOutlinePdf(
  doc: {
    setFont: (font: string, style: string) => void
    setFontSize: (n: number) => void
    setTextColor: (...n: number[]) => void
    text: (t: string, x: number, y: number, opts?: { maxWidth?: number }) => void
    addPage: () => void
  },
  payloads: StructurePayload[],
  fallbackRacks: Rack[],
) {
  const items: StructureOutlineItem[] =
    payloads.length > 0
      ? payloads.flatMap(buildStructureOutline)
      : flattenRows(fallbackRacks).map((r) => ({
          kind: 'sku' as const,
          indent: 0,
          title: `${r.rack} / ${r.side} / Row ${r.row} / ${r.bin}`,
          detail: `${r.sku} · ${r.qty} facings`,
        }))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(20, 30, 40)
  doc.text('Rack structure', 14, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110, 110, 110)
  doc.text('Rack → Side → Row → Bin → SKU  (from structure API)', 14, 22)

  let y = 30
  const pageBottom = 195
  const ensure = (need: number) => {
    if (y + need <= pageBottom) return
    doc.addPage()
    y = 16
  }

  for (const item of items) {
    const x = 14 + item.indent * 7
    if (item.kind === 'rack') {
      ensure(14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(44, 82, 130)
      doc.text(item.title, x, y, { maxWidth: 260 })
      y += 6
      if (item.detail) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(90, 90, 90)
        doc.text(item.detail, x, y, { maxWidth: 260 })
        y += 8
      }
      continue
    }
    if (item.kind === 'side') {
      ensure(12)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(30, 41, 59)
      doc.text(item.title, x, y, { maxWidth: 250 })
      y += 5
      if (item.detail) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(item.detail, x, y, { maxWidth: 250 })
        y += 6
      }
      continue
    }
    if (item.kind === 'row') {
      ensure(10)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(51, 65, 85)
      doc.text(item.title, x, y, { maxWidth: 240 })
      y += 4.5
      if (item.detail) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(110, 110, 110)
        doc.text(item.detail, x, y, { maxWidth: 240 })
        y += 5.5
      }
      continue
    }
    if (item.kind === 'bin') {
      ensure(8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59)
      const binLine = item.detail ? `${item.title}  ·  ${item.detail}` : item.title
      doc.text(binLine, x, y, { maxWidth: 230 })
      y += 5
      continue
    }
    ensure(8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(44, 82, 130)
    const skuLine = item.detail ? `${item.title}  ·  ${item.detail}` : item.title
    doc.text(skuLine, x, y, { maxWidth: 220 })
    y += 5
  }
}

function captureSceneDataUrl(): string | null {
  try {
    return captureRackOnlyPng()
  } catch {
    return null
  }
}

/** Multi-page PDF: structure details + ideal image. */
export async function exportRacksToPdf(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  try {
    const loaded = await loadStructureExports(racks)
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const title =
      loaded.payloads.length === 1
        ? String(loaded.payloads[0].rackName || loaded.payloads[0].rackCode || 'Planogram')
        : loaded.racks.length === 1
          ? loaded.racks[0].blueprintName || loaded.racks[0].rackCode || 'Planogram'
          : baseName

    doc.setFontSize(16) 
    doc.text(String(title), 14, 16)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Exported ${new Date().toLocaleString()}`, 14, 22)
    try {
      const { rackFaceUtilization } = await import('@/utils/faceFill')
      const totals = loaded.racks.reduce(
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
        doc.setFontSize(9)
        doc.setTextColor(100)
        doc.text('3D rack (scene cropped out)', 14, 150)
        doc.setTextColor(0)
      } catch {
        /* canvas may be tainted */
      }
    }

    doc.addPage()
    drawStructureElevationPdf(doc, loaded.racks, loaded.payloads)

    doc.save(sanitizeFilename(baseName, 'pdf'))
    toast.success('Exported PDF from rack structure')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'PDF export failed')
  }
}

/** PowerPoint deck: structure details + ideal image. */
export async function exportRacksToPptx(racks: Rack[], baseName = 'planogram') {
  if (racks.length === 0) {
    toast.error('Nothing to export')
    return
  }
  try {
    const loaded = await loadStructureExports(racks)
    const PptxGenJS = (await import('pptxgenjs')).default
    const pptx = new PptxGenJS()
    const title =
      loaded.payloads.length === 1
        ? String(loaded.payloads[0].rackName || loaded.payloads[0].rackCode || 'Planogram')
        : loaded.racks.length === 1
          ? loaded.racks[0].blueprintName || loaded.racks[0].rackCode || 'Planogram'
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
      const totals = loaded.racks.reduce(
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
      s1.addText('3D rack screenshot (warehouse cropped out)', {
        x: 0.5,
        y: 5.6,
        w: 9,
        h: 0.25,
        fontSize: 10,
        color: '666666',
      })
    } else {
      s1.addText(
        'Open the 3D scene before export to include a screenshot.',
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

    const drawSides = workingElevationSides(loaded.racks, loaded.payloads)
    if (drawSides.length === 0) {
      const slide = pptx.addSlide()
      slide.addText('No working shelves to export', {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 0.4,
        fontSize: 16,
        color: '999999',
      })
    } else {
      for (const side of drawSides) {
        const png = drawStructureElevationCanvas(side)
        const slide = pptx.addSlide()
        slide.addText(`Working shelf · ${side.sideCode}`, {
          x: 0.4,
          y: 0.2,
          w: 9.2,
          h: 0.3,
          fontSize: 16,
          bold: true,
        })
        if (png) {
          slide.addImage({ data: png, x: 0.35, y: 0.55, w: 9.3, h: 6.6 })
        }
      }
    }

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
      void exportRacksAs(area.racks, format, {
        planogramName: selectedStoreName ?? 'Store planogram',
        storeId: selectedStoreId,
        storeName: selectedStoreName,
      })
    },
    exportRack(
      rack: Rack,
      format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>,
    ) {
      void exportRacksAs([rack], format, {
        planogramName: rack.blueprintName ?? rack.rackCode,
        storeId: selectedStoreId,
        storeName: selectedStoreName,
      })
    },
    exportStoreJson() {
      const rack = getSelectedRack()
      if (rack) {
        return exportRacksStructureJson(
          [rack],
          String(rack.blueprintName ?? rack.rackCode ?? 'rack'),
        )
      }
      return exportRacksStructureJson(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportStoreCsv() {
      const rack = getSelectedRack()
      if (rack) {
        return exportRacksToCsv([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
      }
      return exportRacksToCsv(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportRackCsv(rack: Rack) {
      exportRacksToCsv([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
    },
    exportStoreXlsx() {
      const rack = getSelectedRack()
      if (rack) {
        return exportRacksToXlsx([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
      }
      return exportRacksToXlsx(area.racks, selectedStoreName ?? 'store-planogram')
    },
    exportRackXlsx(rack: Rack) {
      return exportRacksToXlsx([rack], rack.blueprintName ?? rack.rackCode ?? 'rack')
    },
    exportSceneImage(name?: string) {
      exportScenePng(name ?? selectedStoreName ?? 'planogram-3d')
    },
    exportWorkingViewPng(name?: string) {
      const rack = getSelectedRack() ?? area.racks[0]
      if (rack) {
        void exportRackPng(rack, name)
        return
      }
      toast.error('Select a rack to export the working shelf view')
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
