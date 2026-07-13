import type {
  RackPublishPreviewResult,
  RackPublishRequest,
  RackPublishResult,
} from '@/types/rackPublish';
import { getPlanogramTokenFromCookie } from '@verseye/utils';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  try {
    const t = getPlanogramTokenFromCookie();
    if (t) headers.Authorization = `Bearer ${t}`;
  } catch {
    /* ignore */
  }
  return headers;
}

export async function fetchPublishPreview(
  serverRackId: string,
  body: RackPublishRequest,
): Promise<{
  success: boolean;
  data?: RackPublishPreviewResult;
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
  body: RackPublishRequest,
): Promise<{
  success: boolean;
  data?: RackPublishResult;
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
