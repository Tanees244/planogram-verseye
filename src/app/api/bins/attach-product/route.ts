import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface AttachRequest {
  binId: string;
  skuId: string;
  quantity: number | string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  let body: AttachRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }

  const binId = typeof body.binId === 'string' ? body.binId.trim() : '';
  const skuId = typeof body.skuId === 'string' ? body.skuId.trim() : '';
  const quantity = Number(body.quantity);

  if (!binId || !skuId) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'binId and skuId are required', statusCode: 400 },
      { status: 400 }
    );
  }

  // The backend expects real uuids for both ids. A non-uuid here (e.g. a
  // locally-generated bin id) is the most common cause of the backend 500.
  if (!UUID_RE.test(binId) || !UUID_RE.test(skuId)) {
    console.error('[attach-product] non-uuid id rejected', { binId, skuId });
    return NextResponse.json(
      {
        isRequestSuccess: false,
        message: !UUID_RE.test(binId)
          ? 'binId is not a valid server id — re-create or reselect the bin and try again'
          : 'skuId is not a valid server id',
        statusCode: 400,
      },
      { status: 400 }
    );
  }

  return proxyLayout(req, '/api/v1/layout/bin-inventory/attach', {
    method: 'POST',
    body: {
      binId,
      skuId,
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1,
    },
  });
}
