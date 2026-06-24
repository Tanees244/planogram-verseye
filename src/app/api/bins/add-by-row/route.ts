import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

const API_BASE_URL = process.env.API_BASE_URL;

interface AddBinRequest {
  rackRowId: string;
  binName?: string;
  aisle?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: AddBinRequest = await req.json();
    const token = await getToken(req);

    if (!token) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 },
        { status: 401 }
      );
    }

    if (!body?.rackRowId || typeof body.rackRowId !== 'string') {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'rackRowId is required', statusCode: 400 },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/ProductApi/IBinFeature/AddBinByRowId`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AddBinByRowId] Backend error (${response.status}):`, errorText);
      return NextResponse.json(
        { isRequestSuccess: false, message: errorText || `Backend returned ${response.status}`, statusCode: response.status },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[AddBinByRowId] Expected JSON but got:', text);
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid response format from backend', statusCode: 502 },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('AddBinByRowId SSR Error:', error);
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
      { status: 500 }
    );
  }
}
