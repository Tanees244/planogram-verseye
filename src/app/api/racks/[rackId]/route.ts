import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest, context: { params: Promise<{ rackId: string }> }) {
  const { rackId } = await context.params;
  return proxyLayout(req, `/api/v1/layout/racks/${encodeURIComponent(rackId)}`, { method: 'GET' });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ rackId: string }> }) {
  const { rackId } = await context.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }
  return proxyLayout(req, `/api/v1/layout/racks/${encodeURIComponent(rackId)}`, {
    method: 'PUT',
    body,
  });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ rackId: string }> }) {
  const { rackId } = await context.params;
  return proxyLayout(req, `/api/v1/layout/racks/${encodeURIComponent(rackId)}`, { method: 'DELETE' });
}
