import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface AddBinRequest {
  rackRowId: string;
  binName?: string | null;
  aisle?: string | null;
  width?: number;
  height?: number;
  depth?: number;
  slotIndex?: number;
  slotCount?: number;
  xStart?: number;
  xEnd?: number;
  products?: unknown[];
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

  const width = Number(body.width);
  const height = Number(body.height);
  const depth = Number(body.depth);

  // Backend validates Width/Height/Depth must be > 0
  if (!Number.isFinite(width) || width <= 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'width must be greater than 0', statusCode: 400 },
      { status: 400 },
    );
  }
  if (!Number.isFinite(height) || height <= 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'height must be greater than 0', statusCode: 400 },
      { status: 400 },
    );
  }
  if (!Number.isFinite(depth) || depth <= 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'depth must be greater than 0', statusCode: 400 },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {
    rackRowId: body.rackRowId,
    binName: body.binName ?? null,
    aisle: body.aisle ?? null,
    width,
    height,
    depth,
    // Empty — attach SKUs afterward via /bin-inventory/attach
    products: Array.isArray(body.products) ? body.products : [],
  };
  if (body.slotIndex != null) payload.slotIndex = body.slotIndex;
  if (body.slotCount != null) payload.slotCount = body.slotCount;
  if (body.xStart != null) payload.xStart = body.xStart;
  if (body.xEnd != null) payload.xEnd = body.xEnd;

  return proxyLayout(req, '/api/v1/layout/bins', { method: 'POST', body: payload });
}
