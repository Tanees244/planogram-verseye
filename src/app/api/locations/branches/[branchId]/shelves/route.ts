import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest, context: { params: Promise<{ branchId: string }> }) {
  const { branchId } = await context.params;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') ?? '';
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return proxyLayout(req, `/api/v1/locations/branches/${encodeURIComponent(branchId)}/shelves${qs}`, {
    method: 'GET',
  });
}
