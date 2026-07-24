import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ skuId: string }> },
) {
  const { skuId } = await context.params;
  if (!skuId || !UUID_RE.test(skuId)) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'skuId must be a valid UUID', statusCode: 400 },
      { status: 400 },
    );
  }

  return proxyLayout(req, `/api/v1/catalog/skus/${encodeURIComponent(skuId)}`, {
    method: 'GET',
    transform: (data) => {
      const s = data ?? {};
      return {
        id: s.id ?? s.skuId,
        name: s.name ?? s.skuName ?? s.title,
        categoryId: s.categoryId ?? null,
        brandId: s.brandId ?? null,
        brandName: s.brandName ?? null,
        categoryName: s.categoryName ?? null,
        ...s,
      };
    },
  });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ skuId: string }> },
) {
  const { skuId } = await context.params;
  if (!skuId || !UUID_RE.test(skuId)) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'skuId must be a valid UUID', statusCode: 400 },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    );
  }

  const toPositive = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const patch: Record<string, unknown> = {};
  const width = toPositive(body.width);
  const height = toPositive(body.height);
  const depth = toPositive(body.depth);
  if (width != null) patch.width = width;
  if (height != null) patch.height = height;
  if (depth != null) patch.depth = depth;
  if (typeof body.imageStorageKey === 'string' && body.imageStorageKey.trim()) {
    patch.imageStorageKey = body.imageStorageKey.trim();
  }
  if (typeof body.modelStorageKey === 'string' && body.modelStorageKey.trim()) {
    patch.modelStorageKey = body.modelStorageKey.trim();
  }
  if (Array.isArray(body.attachments)) {
    patch.attachments = body.attachments
      .filter(
        (a) =>
          a &&
          typeof a === 'object' &&
          typeof (a as { storageKey?: string }).storageKey === 'string' &&
          (a as { storageKey: string }).storageKey.trim(),
      )
      .map((a) => ({
        storageKey: (a as { storageKey: string }).storageKey.trim(),
        is3D: Boolean((a as { is3D?: boolean }).is3D),
      }));
  } else if (Array.isArray(body.attachmentStorageKeys)) {
    patch.attachments = body.attachmentStorageKeys
      .filter((k) => typeof k === 'string' && k.trim())
      .map((storageKey) => ({
        storageKey,
        is3D: storageKey.includes('/models') || storageKey.endsWith('.glb'),
      }));
  }
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.code === 'string' && body.code.trim()) patch.code = body.code.trim();
  if (typeof body.status === 'string') patch.status = body.status;
  // Nullable flags: omit = unchanged; true/false = set (server recomputes placed bin capacity).
  if (body.isHero === true || body.heroSku === true) patch.isHero = true;
  else if (body.isHero === false || body.heroSku === false) patch.isHero = false;
  if (body.isStackable === true || body.stackable === true) patch.isStackable = true;
  else if (body.isStackable === false || body.stackable === false) patch.isStackable = false;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'No valid fields to update', statusCode: 400 },
      { status: 400 },
    );
  }

  return proxyLayout(req, `/api/v1/catalog/skus/${encodeURIComponent(skuId)}`, {
    method: 'PUT',
    body: patch,
  });
}
