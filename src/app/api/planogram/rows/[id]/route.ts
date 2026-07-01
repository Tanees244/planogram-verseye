import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

// Gets rack rows for a given rack side id.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ isRequestSuccess: true, data: [] }, { status: 200 });
  }

  return proxyLayout(req, `/api/v1/layout/rack-rows/by-side/${encodeURIComponent(id)}`, {
    method: 'GET',
    requireAuth: false,
  });
}
