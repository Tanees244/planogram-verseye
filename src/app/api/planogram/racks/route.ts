import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') ?? '1';
  const pageSize = searchParams.get('pageSize') ?? '200';
  return proxyLayout(
    req,
    `/api/v1/layout/racks?page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`,
    { method: 'GET' }
  );
}
