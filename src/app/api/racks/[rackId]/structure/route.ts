import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest, context: { params: Promise<{ rackId: string }> }) {
  const { rackId } = await context.params;
  return proxyLayout(req, `/api/v1/layout/racks/${encodeURIComponent(rackId)}/structure`, {
    method: 'GET',
  });
}
