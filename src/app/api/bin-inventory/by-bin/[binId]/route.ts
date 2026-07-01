import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest, context: { params: Promise<{ binId: string }> }) {
  const { binId } = await context.params;
  return proxyLayout(req, `/api/v1/layout/bin-inventory/by-bin/${encodeURIComponent(binId)}`, {
    method: 'GET',
  });
}
