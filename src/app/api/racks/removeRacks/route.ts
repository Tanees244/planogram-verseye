import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface RemoveRackRequest {
  rackId: string;
}

// Kept as POST so existing callers don't change; forwards to DELETE on the backend.
export async function POST(req: NextRequest) {
  let body: RemoveRackRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }

  const { rackId } = body;
  if (!rackId || typeof rackId !== 'string') {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rackId is required', statusCode: 400 },
      { status: 400 }
    );
  }

  return proxyLayout(req, `/api/v1/layout/racks/${encodeURIComponent(rackId)}`, {
    method: 'DELETE',
  });
}
