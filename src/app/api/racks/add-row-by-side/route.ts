import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface AddRowRequest {
  rackSideId: string;
  note?: string | null;
  height: number;
}

export async function POST(req: NextRequest) {
  let body: AddRowRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
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

  return proxyLayout(req, '/api/v1/layout/rack-rows', {
    method: 'POST',
    body: { rackSideId, note: note ?? null, height },
  });
}
