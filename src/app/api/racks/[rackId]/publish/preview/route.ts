import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function parseBody(req: NextRequest): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
        { status: 400 },
      );
    }
    return body as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    );
  }
}

function validateRackId(rackId: string): NextResponse | null {
  if (!rackId || !UUID_RE.test(rackId)) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rackId must be a valid UUID', statusCode: 400 },
      { status: 400 },
    );
  }
  return null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ rackId: string }> },
) {
  const { rackId } = await context.params;
  const rackErr = validateRackId(rackId);
  if (rackErr) return rackErr;

  const body = await parseBody(req);
  if (body instanceof NextResponse) return body;

  return proxyLayout(req, `/api/v1/layout/racks/${encodeURIComponent(rackId)}/publish/preview`, {
    method: 'POST',
    body,
  });
}
