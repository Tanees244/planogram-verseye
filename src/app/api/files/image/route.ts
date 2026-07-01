import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Same-origin image proxy. WebGL textures require CORS headers from the image
 * host; the MinIO/S3 presigned URLs don't send them, so loading them directly
 * into a Three.js texture fails. Routing them through this endpoint makes the
 * request same-origin and avoids the CORS restriction.
 *
 * Usage: /api/files/image?url=<encoded absolute image url>
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url || !/^https?:\/\//i.test(url)) {
    return new NextResponse('Missing or invalid url', { status: 400 });
  }

  try {
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
  } catch {
    return new NextResponse('Fetch failed', { status: 502 });
  }
}
