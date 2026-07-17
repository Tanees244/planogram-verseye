import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

const API_BASE_URL = process.env.API_BASE_URL;

async function fetchBinary(url: string): Promise<Response> {
  const upstream = await fetch(url, { cache: 'no-store' });
  if (!upstream.ok) {
    return new NextResponse('Upstream error', { status: upstream.status });
  }
  const contentType = upstream.headers.get('content-type') ?? 'image/png';
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Same-origin image proxy for UI + WebGL textures.
 * GET /api/files/image?url=<https://...>
 * GET /api/files/image?key=<objectStorageKey>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const key = searchParams.get('key');

  if (url && /^https?:\/\//i.test(url)) {
    try {
      return await fetchBinary(url);
    } catch {
      return new NextResponse('Fetch failed', { status: 502 });
    }
  }

  if (key && API_BASE_URL) {
    try {
      const token = await getToken(req);
      if (!token) {
        return new NextResponse('Unauthorized', { status: 401 });
      }

      const presignRes = await fetch(`${API_BASE_URL}/api/v1/files/presigned-download`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ objectKey: key }),
        cache: 'no-store',
      });

      const presignText = await presignRes.text();
      let presignJson: Record<string, unknown> = {};
      try {
        presignJson = presignText ? JSON.parse(presignText) : {};
      } catch {
        /* ignore */
      }

      const inner =
        presignJson.data && typeof presignJson.data === 'object'
          ? (presignJson.data as Record<string, unknown>)
          : presignJson;

      const downloadUrl =
        (typeof inner.url === 'string' && inner.url) ||
        (typeof inner.presignedUrl === 'string' && inner.presignedUrl) ||
        (typeof inner.downloadUrl === 'string' && inner.downloadUrl);

      if (!presignRes.ok || !downloadUrl) {
        return new NextResponse('Could not resolve image download URL', {
          status: presignRes.status || 502,
        });
      }

      return await fetchBinary(downloadUrl);
    } catch {
      return new NextResponse('Image proxy failed', { status: 502 });
    }
  }

  return new NextResponse('Missing or invalid url/key', { status: 400 });
}
