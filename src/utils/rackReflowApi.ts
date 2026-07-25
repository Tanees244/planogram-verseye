import type { Rack } from '@/store/planogramStore'
import type {
  MultiRackReflowRequest,
  MultiRackReflowResponse,
  RackReflowRequest,
  RackReflowResult,
  ReflowShellPatch,
} from '@/types/rackReflow'
import {
  normalizeShelfFacingUtilization,
  type ShelfRowUtilization,
} from '@/types/shelfUtilization'
import { customConfigToShell, resolveRackOuter } from '@/utils/rackBlueprintMapper'
import { getPlanogramTokenFromCookie } from '@verseye/utils'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Kind A — ApplyRackReflow / preview body (`outer` + `shell` per OpenAPI). */
export function buildReflowBodyFromRack(rack: Rack): RackReflowRequest {
  const outer = resolveRackOuter(rack)
  const shellSource =
    rack.shell ?? (rack.customConfig ? customConfigToShell(rack.customConfig) : null)

  const shell: ReflowShellPatch = {
    wallThickness:
      shellSource?.wallThickness != null && Number.isFinite(Number(shellSource.wallThickness))
        ? Number(shellSource.wallThickness)
        : rack.customConfig?.wallThickness != null
          ? Number(rack.customConfig.wallThickness)
          : null,
    walls: shellSource?.walls
      ? {
          back: shellSource.walls.back,
          left: shellSource.walls.left,
          right: shellSource.walls.right,
          frontGlass: shellSource.walls.frontGlass,
        }
      : null,
    header: shellSource?.header ?? null,
    footer: shellSource?.footer ?? null,
    frame: shellSource?.frame ?? null,
    materials: shellSource?.materials ?? null,
    headerPosmItemId: shellSource?.headerPosmItemId ?? null,
    footerPosmItemId: shellSource?.footerPosmItemId ?? null,
    leftWallPosmItemId: shellSource?.leftWallPosmItemId ?? null,
    rightWallPosmItemId: shellSource?.rightWallPosmItemId ?? null,
  }

  return {
    outer: {
      width: outer.width,
      depth: outer.depth,
      height: outer.height,
    },
    shell,
  }
}

/** Kind C — only real UUIDs (Swagger rejects empty strings in production). */
export function sanitizeTargetRackIds(ids: string[]): string[] {
  return [
    ...new Set(
      ids
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id) => UUID_RE.test(id)),
    ),
  ]
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

function normalizeRowUtilizations(raw: unknown): ShelfRowUtilization[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const rows: ShelfRowUtilization[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const utilRaw = r.utilization ?? r
    const utilization = normalizeShelfFacingUtilization(utilRaw)
    if (!utilization) continue
    const rowId = String(r.rowId ?? r.row_id ?? r.id ?? '')
    const rowNumberRaw = r.rowNumber ?? r.row_number
    const rowNumber =
      rowNumberRaw != null && Number.isFinite(Number(rowNumberRaw))
        ? Number(rowNumberRaw)
        : null
    rows.push({ rowId, rowNumber, utilization })
  }
  return rows.length > 0 ? rows : undefined
}

function normalizeReflowResult(data: unknown): RackReflowResult {
  const raw = (data ?? {}) as Record<string, unknown>
  const rowUtilizations = normalizeRowUtilizations(
    raw.rowUtilizations ?? raw.row_utilizations,
  )
  return {
    quantityChanges: Array.isArray(raw.quantityChanges) ? raw.quantityChanges : [],
    geometryChanges: Array.isArray(raw.geometryChanges) ? raw.geometryChanges : [],
    exceptions: Array.isArray(raw.exceptions) ? raw.exceptions : [],
    ...(rowUtilizations ? { rowUtilizations } : {}),
  }
}

function extractApiMessage(json: any, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback
  const errors = Array.isArray(json.errors) ? json.errors : []
  const detail = errors
    .map((e: any) => e?.message || e?.code || e?.field)
    .filter(Boolean)
    .join('; ')
  if (detail && detail !== json.message) {
    return `${json.message || fallback}${json.statusCode ? ` (${json.statusCode})` : ''}: ${detail}`
  }
  if (typeof json.message === 'string' && json.message.trim()) {
    const status = json.statusCode ? ` [${json.statusCode}]` : ''
    return `${json.message}${status}`
  }
  return fallback
}

function normalizeMultiResponse(data: unknown): MultiRackReflowResponse {
  const raw = (data ?? {}) as Record<string, unknown>
  const targetsRaw = Array.isArray(raw.targets)
    ? raw.targets
    : Array.isArray(raw.results)
      ? raw.results
      : []
  return {
    targets: targetsRaw.map((t) => {
      const target = (t ?? {}) as Record<string, unknown>
      const result = normalizeReflowResult(target)
      return {
        rackId: String(target.rackId ?? target.id ?? ''),
        storeId: String(target.storeId ?? ''),
        status:
          (target.status as MultiRackReflowResponse['targets'][number]['status']) ?? 'blocked',
        outer: (target.outer as MultiRackReflowResponse['targets'][number]['outer']) ?? null,
        quantityChanges: result.quantityChanges,
        geometryChanges: result.geometryChanges,
        exceptions: result.exceptions,
        warnings: Array.isArray(target.warnings) ? (target.warnings as string[]) : [],
        errors: Array.isArray(target.errors) ? (target.errors as string[]) : [],
        ...(result.rowUtilizations ? { rowUtilizations: result.rowUtilizations } : {}),
      }
    }),
  }
}

export async function fetchReflowPreview(
  serverRackId: string,
  body: RackReflowRequest,
): Promise<{ success: boolean; data?: RackReflowResult; message?: string }> {
  try {
    const res = await fetch(`/api/racks/${encodeURIComponent(serverRackId)}/reflow/preview`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: extractApiMessage(json, 'Reflow preview failed') }
    }
    return { success: true, data: normalizeReflowResult(json?.data ?? json) }
  } catch {
    return { success: false, message: 'Network error during reflow preview' }
  }
}

export async function fetchApplyReflow(
  serverRackId: string,
  body: RackReflowRequest,
): Promise<{ success: boolean; data?: RackReflowResult; message?: string }> {
  try {
    const res = await fetch(`/api/racks/${encodeURIComponent(serverRackId)}/reflow`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: extractApiMessage(json, 'Reflow apply failed') }
    }
    return {
      success: true,
      data: normalizeReflowResult(json?.data ?? json),
      message: json?.message || 'Reflow applied',
    }
  } catch {
    return { success: false, message: 'Network error during reflow apply' }
  }
}

export async function fetchMultiRackReflowPreview(
  sourceRackId: string,
  body: MultiRackReflowRequest,
): Promise<{ success: boolean; data?: MultiRackReflowResponse; message?: string }> {
  const targetRackIds = sanitizeTargetRackIds(body.targetRackIds)
  if (targetRackIds.length === 0) {
    return { success: false, message: 'Select at least one valid target rack UUID' }
  }
  try {
    const res = await fetch(
      `/api/racks/${encodeURIComponent(sourceRackId)}/reflow-to-racks/preview`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ targetRackIds }),
      },
    )
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.isRequestSuccess === false) {
      return {
        success: false,
        message: extractApiMessage(json, 'Multi-rack reflow preview failed'),
      }
    }
    // Swagger may return empty body; unwrap when present
    const payload = json?.data !== undefined ? json.data : json
    const data = normalizeMultiResponse(payload)
    if (data.targets.length === 0 && payload && typeof payload === 'object') {
      // Some environments return envelope without nested targets on empty apply/preview
      if (Array.isArray((payload as any).quantityChanges)) {
        return {
          success: false,
          message:
            'Got a single-rack reflow payload from reflow-to-racks/preview. Expected data.targets[].',
        }
      }
    }
    if (data.targets.length === 0) {
      return {
        success: false,
        message:
          'Preview returned no target results. Expected data.targets[] from reflow-to-racks/preview.',
      }
    }
    return { success: true, data }
  } catch {
    return { success: false, message: 'Network error during multi-rack reflow preview' }
  }
}

export async function fetchApplyMultiRackReflow(
  sourceRackId: string,
  body: MultiRackReflowRequest,
): Promise<{ success: boolean; data?: MultiRackReflowResponse; message?: string }> {
  const targetRackIds = sanitizeTargetRackIds(body.targetRackIds)
  if (targetRackIds.length === 0) {
    return { success: false, message: 'Select at least one valid target rack UUID' }
  }
  try {
    const res = await fetch(`/api/racks/${encodeURIComponent(sourceRackId)}/reflow-to-racks`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ targetRackIds }),
    })
    const text = await res.text()
    let json: any = {}
    if (text) {
      try {
        json = JSON.parse(text)
      } catch {
        json = {}
      }
    }
    if (!res.ok || json?.isRequestSuccess === false) {
      const base = extractApiMessage(json, 'Multi-rack reflow apply failed')
      const hint =
        res.status >= 500
          ? ' Layout API crashed while persisting (preview is dry-run only). Check backend logs for reflow-to-racks.'
          : ''
      return { success: false, message: `${base}${hint}` }
    }
    // OpenAPI "200 No Body" = success with no payload
    if (!text || text.trim() === '' || text.trim() === 'null') {
      return {
        success: true,
        data: {
          targets: targetRackIds.map((rackId) => ({
            rackId,
            storeId: '',
            status: 'applied' as const,
            outer: null,
            quantityChanges: [],
            geometryChanges: [],
            exceptions: [],
            warnings: [],
            errors: [],
          })),
        },
        message: 'Multi-rack reflow applied',
      }
    }
    const payload = json?.data !== undefined ? json.data : json
    return {
      success: true,
      data: normalizeMultiResponse(payload),
      message: json?.message || 'Multi-rack reflow applied',
    }
  } catch {
    return { success: false, message: 'Network error during multi-rack reflow apply' }
  }
}
