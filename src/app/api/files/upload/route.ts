import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

const API_BASE_URL = process.env.API_BASE_URL;

// Forwards a multipart file upload to the catalog backend.
// POST /api/files/upload?folder=planograms  (FormData { file })
export async function POST(req: NextRequest) {
  try {
    if (!API_BASE_URL) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Server configuration error', statusCode: 500 },
        { status: 500 }
      );
    }

    const token = await getToken(req);
    if (!token) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 },
        { status: 401 }
      );
    }

    const incoming = await req.formData();
    const forward = new FormData();
    for (const [key, value] of incoming.entries()) {
      forward.append(key, value as any);
    }

    const { searchParams } = new URL(req.url);
    const folder = searchParams.get('folder') ?? 'planograms';

    // Do NOT set Content-Type manually; fetch sets the multipart boundary.
    const res = await fetch(
      `${API_BASE_URL}/api/v1/files/upload?folder=${encodeURIComponent(folder)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: forward,
      }
    );

    const text = await res.text();
    let data: any = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      console.error('[files/upload] Backend error', res.status, text);
      const message =
        (data && typeof data === 'object' && (data.message || data.title)) ||
        (typeof data === 'string' && data) ||
        `Backend returned ${res.status}`;
      return NextResponse.json(
        { isRequestSuccess: false, message, statusCode: res.status, data: null },
        { status: res.status }
      );
    }

    const success =
      data && typeof data === 'object'
        ? data.isRequestSuccess ?? data.success ?? true
        : true;
    const inner =
      data && typeof data === 'object' ? data.data ?? data : data;

    return NextResponse.json({ isRequestSuccess: success, data: inner }, { status: res.status });
  } catch (error) {
    console.error('[files/upload] SSR error:', error);
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
      { status: 500 }
    );
  }
}
