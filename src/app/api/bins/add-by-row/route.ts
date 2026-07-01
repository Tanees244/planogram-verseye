import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface AddBinRequest {
  rackRowId: string;
  binName?: string | null;
  aisle?: string | null;
}

export async function POST(req: NextRequest) {
  let body: AddBinRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }

  if (!body?.rackRowId || typeof body.rackRowId !== 'string') {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rackRowId is required', statusCode: 400 },
      { status: 400 }
    );
  }

  return proxyLayout(req, '/api/v1/layout/bins', {
    method: 'POST',
    body: {
      rackRowId: body.rackRowId,
      binName: body.binName ?? null,
      aisle: body.aisle ?? null,
    },
  });
}
