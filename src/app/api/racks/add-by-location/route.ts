import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

const API_BASE_URL = process.env.API_BASE_URL;

interface AddRackByLocationRequest {
  globalLocationId: string;
  rackCode: string;
  height: number;
  width: number;
  isDoubleSided: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: AddRackByLocationRequest = await req.json();
    const token = await getToken(req);
    if (token) {
      console.log(`[AddRackByLocation] Fetching with token starting with: ${token.substring(0, 10)}...`);
    }

    if (!token) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 },
        { status: 401 }
      );
    }

    const { globalLocationId, rackCode, height, width, isDoubleSided } = body;

    // ✅ Server-side validation
    if (!globalLocationId || typeof globalLocationId !== 'string') {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'globalLocationId is required', statusCode: 400 },
        { status: 400 }
      );
    }

    if (!rackCode || typeof rackCode !== 'string') {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'rackCode is required', statusCode: 400 },
        { status: 400 }
      );
    }

    if (typeof height !== 'number' || height <= 0) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid height', statusCode: 400 },
        { status: 400 }
      );
    }

    if (typeof width !== 'number' || width <= 0) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid width', statusCode: 400 },
        { status: 400 }
      );
    }

    if (typeof isDoubleSided !== 'boolean') {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'isDoubleSided must be boolean', statusCode: 400 },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}/IRackStructureFeature/AddRackByLocation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AddRackByLocation] Backend error (${response.status}):`, errorText);
      return NextResponse.json(
        {
          isRequestSuccess: false,
          message: errorText || `Backend returned ${response.status}`,
          statusCode: response.status
        },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[AddRackByLocation] Expected JSON but got:', text);
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid response format from backend', statusCode: 502 },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('AddRackByLocation SSR Error:', error);
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
      { status: 500 }
    );
  }
}