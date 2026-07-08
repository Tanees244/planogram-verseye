import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface DetachRequest {
  binId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: DetachRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    );
  }

  const binId = typeof body.binId === 'string' ? body.binId.trim() : '';
  if (!binId) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'binId is required', statusCode: 400 },
      { status: 400 },
    );
  }
  if (!UUID_RE.test(binId)) {
    return NextResponse.json(
      {
        isRequestSuccess: false,
        message: 'binId must be a valid server UUID',
        statusCode: 400,
      },
      { status: 400 },
    );
  }

  return proxyLayout(req, '/api/v1/layout/bin-inventory/detach', {
    method: 'POST',
    body: { binId },
  });
}
