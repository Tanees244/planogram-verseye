import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

const API_BASE_URL = process.env.API_BASE_URL;

interface AddRowRequest {
  rackSideId: string;
  note?: string;
  height: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: AddRowRequest = await req.json();
    const token = await getToken(req);

    if (!token) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 },
        { status: 401 }
      );
    }

    const { rackSideId, note, height } = body;

    if (!rackSideId || typeof rackSideId !== 'string') {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'rackSideId is required', statusCode: 400 },
        { status: 400 }
      );
    }

    if (typeof height !== 'number' || height <= 0) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid height', statusCode: 400 },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/ProductApi/IRackRowFeature/AddRackRowByRackSideId`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rackSideId, note, height }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AddRackRowByRackSideId] Backend error (${response.status}):`, errorText);
      return NextResponse.json(
        { isRequestSuccess: false, message: errorText || `Backend returned ${response.status}`, statusCode: response.status },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[AddRackRowByRackSideId] Expected JSON but got:', text);
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid response format from backend', statusCode: 502 },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('AddRackRowByRackSideId SSR Error:', error);
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
      { status: 500 }
    );
  }
}
