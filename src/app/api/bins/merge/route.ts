import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface MergeBinsRequest {
  binIds: string[];
}

export async function POST(req: NextRequest) {
  let body: MergeBinsRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }

  if (!Array.isArray(body?.binIds) || body.binIds.length === 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'binIds is required', statusCode: 400 },
      { status: 400 }
    );
  }

  return proxyLayout(req, '/api/v1/layout/bins/merge', {
    method: 'POST',
    body: { binIds: body.binIds },
  });
}
