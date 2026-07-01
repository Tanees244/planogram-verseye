import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') ?? '1';
  const pageSize = searchParams.get('pageSize') ?? '200';
  return proxyLayout(
    req,
    `/api/v1/layout/blueprints?page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`,
    { method: 'GET' }
  );
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
  return proxyLayout(req, '/api/v1/layout/blueprints', { method: 'POST', body });
}
