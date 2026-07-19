import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function PUT(req: NextRequest, context: { params: Promise<{ rowId: string }> }) {
  const { rowId } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    );
  }

  return proxyLayout(req, `/api/v1/layout/rack-rows/${encodeURIComponent(rowId)}`, {
    method: 'PUT',
    body,
  });
}

/** DELETE /api/rack-rows/{rowId} → DELETE /api/v1/layout/rack-rows/{id} */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ rowId: string }> },
) {
  const { rowId } = await context.params;
  if (!rowId) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rowId is required', statusCode: 400 },
      { status: 400 },
    );
  }
  return proxyLayout(req, `/api/v1/layout/rack-rows/${encodeURIComponent(rowId)}`, {
    method: 'DELETE',
  });
}
