import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface AddRackRequest {
  // New field name. `globalLocationId` is accepted for backwards compatibility.
  storeId?: string;
  globalLocationId?: string;
  rackCode: string;
  height: number;
  width: number;
  isDoubleSided: boolean;
}

export async function POST(req: NextRequest) {
  let body: AddRackRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }

  const storeId = body.storeId ?? body.globalLocationId;
  const { rackCode, height, width, isDoubleSided } = body;

  if (!storeId || typeof storeId !== 'string') {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'storeId is required', statusCode: 400 },
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

  return proxyLayout(req, '/api/v1/layout/racks', {
    method: 'POST',
    body: { storeId, rackCode, height, width, isDoubleSided },
  });
}
