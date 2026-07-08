import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ binId: string }> },
) {
  const { binId } = await context.params;
  if (!binId || !UUID_RE.test(binId)) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'binId must be a valid UUID', statusCode: 400 },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    );
  }

  const toPositive = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const patch: Record<string, unknown> = {};
  const width = toPositive(body.width);
  const height = toPositive(body.height);
  const depth = toPositive(body.depth);
  if (width != null) patch.width = width;
  if (height != null) patch.height = height;
  if (depth != null) patch.depth = depth;
  if (typeof body.binName === 'string') patch.binName = body.binName;
  if (body.slotIndex != null) patch.slotIndex = body.slotIndex;
  if (body.slotCount != null) patch.slotCount = body.slotCount;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'No valid fields to update', statusCode: 400 },
      { status: 400 },
    );
  }

  return proxyLayout(req, `/api/v1/layout/bins/${encodeURIComponent(binId)}`, {
    method: 'PUT',
    body: patch,
  });
}
