import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface AddRackRequest {
  // New field name. `globalLocationId` is accepted for backwards compatibility.
  storeId?: string;
  globalLocationId?: string;
  rackCode: string;
  height?: number;
  width?: number;
  depth?: number;
  isDoubleSided: boolean;
  /** Blueprint contract fields (CUSTOM fixtures). */
  fixtureType?: string;
  blueprintName?: string;
  outer?: { width: number; depth: number; height: number };
  shell?: Record<string, unknown>;
  placement?: Record<string, unknown>;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  rotationY?: number;
}

export async function POST(req: NextRequest) {
  let body: AddRackRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 }
    );
  }

  const storeId = body.storeId ?? body.globalLocationId;
  const { rackCode, isDoubleSided } = body;
  const isBlueprint = Boolean(body.outer && body.shell);

  if (!storeId || typeof storeId !== 'string') {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'storeId is required', statusCode: 400 },
      { status: 400 }
    );
  }
  if (!rackCode || typeof rackCode !== 'string') {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rackCode is required', statusCode: 400 },
      { status: 400 }
    );
  }
  if (typeof isDoubleSided !== 'boolean') {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'isDoubleSided must be boolean', statusCode: 400 },
      { status: 400 }
    );
  }

  if (isBlueprint) {
    const outer = body.outer!;
    if (
      typeof outer.width !== 'number' ||
      outer.width <= 0 ||
      typeof outer.depth !== 'number' ||
      outer.depth <= 0 ||
      typeof outer.height !== 'number' ||
      outer.height <= 0
    ) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid outer dimensions', statusCode: 400 },
        { status: 400 }
      );
    }
    return proxyLayout(req, '/api/v1/layout/racks', {
      method: 'POST',
      body: {
        storeId,
        rackCode,
        isDoubleSided,
        fixtureType: body.fixtureType ?? 'CUSTOM',
        blueprintName: body.blueprintName ?? rackCode,
        outer: body.outer,
        shell: body.shell,
        placement: body.placement,
        width: outer.width,
        depth: outer.depth,
        height: outer.height,
      },
    });
  }

  const height = body.height ?? body.depth;
  const width = body.width;
  if (typeof height !== 'number' || height <= 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid height', statusCode: 400 },
      { status: 400 }
    );
  }
  if (typeof width !== 'number' || width <= 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid width', statusCode: 400 },
      { status: 400 }
    );
  }

  return proxyLayout(req, '/api/v1/layout/racks', {
    method: 'POST',
    body: {
      storeId,
      rackCode,
      height,
      width,
      isDoubleSided,
      ...(body.fixtureType ? { fixtureType: body.fixtureType } : {}),
      ...(body.blueprintName ? { blueprintName: body.blueprintName } : {}),
      ...(body.depth != null ? { depth: body.depth } : {}),
      ...(body.outer ? { outer: body.outer } : {}),
      ...(body.placement ? { placement: body.placement } : {}),
      ...(body.positionX != null ? { positionX: body.positionX } : {}),
      ...(body.positionY != null ? { positionY: body.positionY } : {}),
      ...(body.positionZ != null ? { positionZ: body.positionZ } : {}),
      ...(body.rotationY != null ? { rotationY: body.rotationY } : {}),
    },
  });
}
