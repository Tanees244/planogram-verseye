import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface AddRackRequest {
  // New field name. `globalLocationId` is accepted for backwards compatibility.
  storeId?: string;
  globalLocationId?: string;
  /** Preferred display name (FRONTEND_RACK_NAME_AND_AUTO_CODE). */
  rackName?: string;
  /** Legacy alias — accepted if rackName is omitted. */
  blueprintName?: string;
  /**
   * Some BE builds still require RackCode on create (even when docs say auto-code).
   * Optional from client; otherwise derived from rackName.
   */
  rackCode?: string;
  height?: number;
  width?: number;
  depth?: number;
  isDoubleSided: boolean;
  /** Contract fields (CUSTOM fixtures). */
  fixtureType?: string;
  outer?: { width: number; depth: number; height: number };
  shell?: Record<string, unknown>;
  placement?: Record<string, unknown>;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  rotationY?: number;
}

function resolveRackName(body: AddRackRequest): string | null {
  const fromName = typeof body.rackName === 'string' ? body.rackName.trim() : '';
  if (fromName) return fromName;
  const fromLegacy =
    typeof body.blueprintName === 'string' ? body.blueprintName.trim() : '';
  return fromLegacy || null;
}

/** "Dairy Gondola A" → "DAIRY-GONDOLA-A" (matches BE auto-code style). */
function rackCodeFromName(name: string): string {
  const code = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return code || `RACK-${Date.now()}`;
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
  const rackName = resolveRackName(body);
  const { isDoubleSided } = body;
  const isBlueprint = Boolean(body.outer && body.shell);

  if (!storeId || typeof storeId !== 'string') {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'storeId is required', statusCode: 400 },
      { status: 400 }
    );
  }
  if (!rackName) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'rackName is required', statusCode: 400 },
      { status: 400 }
    );
  }
  if (typeof isDoubleSided !== 'boolean') {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'isDoubleSided must be boolean', statusCode: 400 },
      { status: 400 }
    );
  }

  const rackCode =
    (typeof body.rackCode === 'string' && body.rackCode.trim()) ||
    rackCodeFromName(rackName);

  // rackName = display name; rackCode required by current BE validation.
  // blueprintName mirrored for older blueprint create paths.
  const nameFields = { rackName, rackCode, blueprintName: rackName };

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
        ...nameFields,
        isDoubleSided,
        fixtureType: body.fixtureType ?? 'CUSTOM',
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
      ...nameFields,
      height,
      width,
      isDoubleSided,
      ...(body.fixtureType ? { fixtureType: body.fixtureType } : {}),
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
