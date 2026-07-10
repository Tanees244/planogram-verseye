import type { Rack } from '@/store/planogramStore';
import type { RackReflowRequest } from '@/types/rackReflow';
import { resolveRackOuter } from '@/utils/rackBlueprintMapper';
import { getPlanogramTokenFromCookie } from '@verseye/utils';

/** Build reflow preview/apply body from current local rack state. */
export function buildReflowBodyFromRack(rack: Rack): RackReflowRequest {
  const outer = resolveRackOuter(rack);
  const wallThickness =
    rack.shell?.wallThickness ??
    rack.customConfig?.wallThickness ??
    undefined;

  const body: RackReflowRequest = {
    outer: {
      width: outer.width,
      depth: outer.depth,
      height: outer.height,
    },
  };

  if (wallThickness != null && Number.isFinite(Number(wallThickness))) {
    body.shell = { wallThickness: Number(wallThickness) };
  }

  return body;
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

export async function fetchReflowPreview(
  serverRackId: string,
  body: RackReflowRequest,
): Promise<{ success: boolean; data?: import('@/types/rackReflow').RackReflowPreview; message?: string }> {
  try {
    const res = await fetch(`/api/racks/${encodeURIComponent(serverRackId)}/reflow/preview`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: json?.message || 'Reflow preview failed' };
    }
    const data = json?.data ?? json;
    return {
      success: true,
      data: {
        quantityChanges: Array.isArray(data.quantityChanges) ? data.quantityChanges : [],
        geometryChanges: Array.isArray(data.geometryChanges) ? data.geometryChanges : [],
        exceptions: Array.isArray(data.exceptions) ? data.exceptions : [],
      },
    };
  } catch {
    return { success: false, message: 'Network error during reflow preview' };
  }
}

export async function fetchApplyReflow(
  serverRackId: string,
  body: RackReflowRequest,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/racks/${encodeURIComponent(serverRackId)}/reflow`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: json?.message || 'Reflow apply failed' };
    }
    return { success: true, message: json?.message || 'Reflow applied' };
  } catch {
    return { success: false, message: 'Network error during reflow apply' };
  }
}

export async function fetchPublishPreview(
  serverRackId: string,
  body: import('@/types/rackReflow').RackPublishRequest,
): Promise<{
  success: boolean;
  data?: import('@/types/rackReflow').RackPublishPreviewResult;
  message?: string;
}> {
  try {
    const res = await fetch(`/api/racks/${encodeURIComponent(serverRackId)}/publish/preview`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: json?.message || 'Publish preview failed' };
    }
    const data = json?.data ?? json;
    const stores = Array.isArray(data.stores) ? data.stores : [];
    return { success: true, data: { stores } };
  } catch {
    return { success: false, message: 'Network error during publish preview' };
  }
}

export async function fetchPublishRack(
  serverRackId: string,
  body: import('@/types/rackReflow').RackPublishRequest,
): Promise<{
  success: boolean;
  data?: import('@/types/rackReflow').RackPublishResult;
  message?: string;
}> {
  try {
    const res = await fetch(`/api/racks/${encodeURIComponent(serverRackId)}/publish`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.isRequestSuccess === false) {
      return { success: false, message: json?.message || 'Publish failed' };
    }
    const data = json?.data ?? json;
    const results = Array.isArray(data.results) ? data.results : [];
    return { success: true, data: { results }, message: json?.message };
  } catch {
    return { success: false, message: 'Network error during publish' };
  }
}
