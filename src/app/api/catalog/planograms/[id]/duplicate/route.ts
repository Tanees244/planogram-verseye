import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyLayout(req, `/api/v1/catalog/planograms/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  });
}
