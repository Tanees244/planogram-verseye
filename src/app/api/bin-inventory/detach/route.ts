import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface DetachRequest {
  binId: string;
  skuId?: string;
  productId?: string;
  quantity: number;
}

export async function POST(req: NextRequest) {
  let body: DetachRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }

  const skuId = body.skuId ?? body.productId;
  const quantity = Number(body.quantity);

  if (!body?.binId || !skuId) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'binId and skuId are required', statusCode: 400 },
      { status: 400 }
    );
  }

  return proxyLayout(req, '/api/v1/layout/bin-inventory/detach', {
    method: 'POST',
    body: {
      binId: body.binId,
      skuId,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    },
  });
}
