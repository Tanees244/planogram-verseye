import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

const API_BASE_URL = process.env.API_BASE_URL;

export async function GET(req: NextRequest) {
  try {
    const token = await getToken(req);
    if (!token) {
      return NextResponse.json({ isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 }, { status: 401 });
    }

    if (!API_BASE_URL) {
      console.error('[GetAllRacks] API_BASE_URL not set');
      return NextResponse.json({ isRequestSuccess: false, message: 'Server configuration error', statusCode: 500 }, { status: 500 });
    }

    const res = await fetch(`${API_BASE_URL}/ProductApi/IRackStructureFeature/GetAllRacks`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[GetAllRacks] Backend error', res.status, text);
      return NextResponse.json({ isRequestSuccess: false, message: text || `Backend returned ${res.status}`, statusCode: res.status }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('[GetAllRacks] Expected JSON but got:', text);
      return NextResponse.json({ isRequestSuccess: false, message: 'Invalid response format from backend', statusCode: 502 }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[GetAllRacks] SSR Error:', err);
    return NextResponse.json({ isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 }, { status: 500 });
  }
}
