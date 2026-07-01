import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest, context: { params: Promise<{ rowId: string }> }) {
  const { rowId } = await context.params;
  return proxyLayout(req, `/api/v1/layout/rack-rows/${encodeURIComponent(rowId)}/inventory`, {
    method: 'GET',
  });
}
