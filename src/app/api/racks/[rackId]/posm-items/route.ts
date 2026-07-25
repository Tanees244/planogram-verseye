import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ rackId: string }> },
) {
  const { rackId } = await context.params;
  if (!rackId || !UUID_RE.test(rackId)) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rackId must be a valid UUID', statusCode: 400 },
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

  const patch: Record<string, unknown> = {};
  const shellKeys = [
    'headerPosmItemId',
    'footerPosmItemId',
    'leftWallPosmItemId',
    'rightWallPosmItemId',
  ] as const;
  for (const key of shellKeys) {
    if (key in body) {
      const v = body[key];
      patch[key] = v === null || v === '' ? null : v;
    }
  }

  if (Array.isArray(body.rowPosmItems)) {
    patch.rowPosmItems = body.rowPosmItems
      .filter((r) => r && typeof r === 'object' && typeof (r as any).rowId === 'string')
      .map((r: any) => ({
        rowId: r.rowId,
        dividerPosmItemId:
          r.dividerPosmItemId === null || r.dividerPosmItemId === ''
            ? null
            : r.dividerPosmItemId,
      }));
  }

  if (Array.isArray(body.binPosmItems)) {
    patch.binPosmItems = body.binPosmItems
      .filter((b) => b && typeof b === 'object' && typeof (b as any).binId === 'string')
      .map((b: any) => ({
        binId: b.binId,
        itemTagPosmItemId:
          b.itemTagPosmItemId === null || b.itemTagPosmItemId === ''
            ? null
            : b.itemTagPosmItemId,
      }));
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'No POSM fields to update', statusCode: 400 },
      { status: 400 },
    );
  }

  return proxyLayout(req, `/api/v1/layout/racks/${encodeURIComponent(rackId)}/posm-items`, {
    method: 'PUT',
    body: patch,
  });
}
