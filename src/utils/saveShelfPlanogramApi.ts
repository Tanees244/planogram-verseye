import { getPlanogramTokenFromCookie } from '@verseye/utils'
import { extractApiErrorMessage } from '@/utils/apiMessages'

function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) headers.Authorization = `Bearer ${t}`
  } catch {
    /* ignore */
  }
  return headers
}

export async function updateShelfName(
  shelfId: string,
  name: string,
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/layout/shelves/${encodeURIComponent(shelfId)}`, {
    method: 'PUT',
    headers: authHeaders(true),
    body: JSON.stringify({ shelfId, name: name.trim() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.isRequestSuccess === false || data?.success === false) {
    return { success: false, message: extractApiErrorMessage(data, 'Failed to save planogram name') }
  }
  return { success: true, message: data?.message || 'Planogram name saved' }
}

export async function uploadShelfIdealImage(
  shelfId: string,
  file: File,
): Promise<{ success: boolean; message?: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(
    `/api/layout/shelves/${encodeURIComponent(shelfId)}/planogram/ideal-image`,
    {
      method: 'PUT',
      headers: authHeaders(false),
      body: form,
    },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.isRequestSuccess === false || data?.success === false) {
    return {
      success: false,
      message: extractApiErrorMessage(data, 'Failed to upload ideal image'),
    }
  }
  return { success: true, message: data?.message || 'Ideal image saved' }
}

/** Resolve shelfId for a rack side, refreshing structure if missing locally. */
export async function resolveRackSideShelfId(
  rackId: string,
  sideId: string,
): Promise<{ success: boolean; shelfId?: string; message?: string }> {
  const res = await fetch(`/api/racks/${encodeURIComponent(rackId)}/structure`, {
    headers: authHeaders(false),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.isRequestSuccess === false) {
    return {
      success: false,
      message: extractApiErrorMessage(data, 'Could not load rack structure for shelf id'),
    }
  }
  const rack = data?.data?.rack ?? data?.data ?? data?.rack
  const sides = Array.isArray(rack?.sides) ? rack.sides : []
  const side =
    sides.find(
      (s: { sideId?: string; id?: string }) =>
        s.sideId === sideId || s.id === sideId,
    ) ?? sides[0]
  const shelfId =
    side?.shelfId ??
    side?.shelf_id ??
    side?.shelf?.id ??
    side?.shelf?.shelfId ??
    null
  if (!shelfId || typeof shelfId !== 'string') {
    return {
      success: false,
      message:
        'No shelf is linked to this rack face yet. Place/save the rack on the server first.',
    }
  }
  return { success: true, shelfId }
}
