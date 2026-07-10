import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, context: { params: Promise<{ binId: string }> }) {
  const { binId } = await context.params;
  if (!binId || !UUID_RE.test(binId)) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'binId must be a valid UUID', statusCode: 400 },
      { status: 400 },
    );
  }
  return proxyLayout(req, `/api/v1/layout/bin-inventory/by-bin/${encodeURIComponent(binId)}`, {
    method: 'GET',
  });
}
