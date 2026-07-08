import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface CreateShelfTalkerBody {
  rackRowId: string;
  label?: string | null;
  length: number;
  innerDepth: number;
  outerHeight: number;
  slotPosition: number;
  placementZone?: string;
}

export async function POST(req: NextRequest) {
  let body: CreateShelfTalkerBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    );
  }

  const rackRowId = typeof body.rackRowId === 'string' ? body.rackRowId.trim() : '';
  if (!rackRowId) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rackRowId is required', statusCode: 400 },
      { status: 400 },
    );
  }

  const length = Number(body.length);
  const innerDepth = Number(body.innerDepth);
  const outerHeight = Number(body.outerHeight);
  const slotPosition = Number(body.slotPosition);

  if (![length, innerDepth, outerHeight].every((n) => Number.isFinite(n) && n > 0)) {
    return NextResponse.json(
      {
        isRequestSuccess: false,
        message: 'length, innerDepth, and outerHeight must be positive numbers',
        statusCode: 400,
      },
      { status: 400 },
    );
  }
  if (!Number.isFinite(slotPosition) || slotPosition < 1) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'slotPosition must be >= 1', statusCode: 400 },
      { status: 400 },
    );
  }

  return proxyLayout(req, '/api/v1/layout/shelf-talkers', {
    method: 'POST',
    body: {
      rackRowId,
      label: body.label ?? null,
      length,
      innerDepth,
      outerHeight,
      slotPosition,
      placementZone: body.placementZone ?? 'inner',
    },
  });
}
