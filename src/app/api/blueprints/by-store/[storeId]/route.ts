import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest, context: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await context.params;
  return proxyLayout(req, `/api/v1/layout/blueprints/by-store/${encodeURIComponent(storeId)}`, {
    method: 'GET',
  });
}
