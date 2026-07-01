import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

const LIST_PARAMS = [
  'search',
  'storeId',
  'categoryId',
  'shelfType',
  'isActive',
  'status',
  'page',
  'pageSize',
] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  for (const key of LIST_PARAMS) {
    const v = searchParams.get(key);
    if (v != null && v !== '') qs.set(key, v);
  }
  if (!qs.has('page')) qs.set('page', '1');
  if (!qs.has('pageSize')) qs.set('pageSize', '20');
  return proxyLayout(req, `/api/v1/catalog/planograms?${qs.toString()}`, { method: 'GET' });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }
  return proxyLayout(req, '/api/v1/catalog/planograms', { method: 'POST', body });
}
