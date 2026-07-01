import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest, context: { params: Promise<{ rackRowId: string }> }) {
  const { rackRowId } = await context.params;
  return proxyLayout(req, `/api/v1/layout/bins/by-row/${encodeURIComponent(rackRowId)}`, {
    method: 'GET',
  });
}
