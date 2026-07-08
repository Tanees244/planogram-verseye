import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface AddRowRequest {
  rackSideId: string;
  note?: string | null;
  height: number;
  span?: number;
  width?: number;
  depth?: number;
  sided?: string;
  dividerThickness?: number;
  yStart?: number;
  yEnd?: number;
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

  const { rackSideId, note, height, span, width, depth, sided, dividerThickness, yStart, yEnd } =
    body;

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

  const payload: Record<string, unknown> = { rackSideId, note: note ?? null, height };
  if (span != null) payload.span = span;
  if (width != null) payload.width = width;
  if (depth != null) payload.depth = depth;
  if (sided != null) payload.sided = sided;
  if (dividerThickness != null) payload.dividerThickness = dividerThickness;
  if (yStart != null) payload.yStart = yStart;
  if (yEnd != null) payload.yEnd = yEnd;

  return proxyLayout(req, '/api/v1/layout/rack-rows', { method: 'POST', body: payload });
}
