import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { proxyLayout } from '@/app/api/utils/layoutProxy';

interface CreateSkuBody {
  categoryId?: string | null;
  subCategoryId?: string | null;
  brandId?: string | null;
  variant?: string | null;
  size?: string | null;
  name?: string;
  code?: string;
  barcode?: string | null;
  pack?: string | null;
  netContent?: string | null;
  storageType?: string | null;
  shelfLifeDays?: number | null;
  imageStorageKey?: string | null;
  modelStorageKey?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  attachmentStorageKeys?: string[] | null;
  attachments?: { storageKey: string; is3D: boolean }[] | null;
  status?: string;
  isHero?: boolean | null;
  isStackable?: boolean | null;
  heroSku?: boolean | null;
  stackable?: boolean | null;
}

export async function POST(req: NextRequest) {
  let body: CreateSkuBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const categoryId =
    typeof body.categoryId === 'string' && body.categoryId.trim()
      ? body.categoryId.trim()
      : null;

  if (!name) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'name is required', statusCode: 400 },
      { status: 400 },
    );
  }
  if (!code) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'code is required', statusCode: 400 },
      { status: 400 },
    );
  }
  if (!categoryId) {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'categoryId is required', statusCode: 400 },
      { status: 400 },
    );
  }

  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const imageStorageKey =
    typeof body.imageStorageKey === 'string' && body.imageStorageKey.trim()
      ? body.imageStorageKey.trim()
      : null;
  const modelStorageKey =
    typeof body.modelStorageKey === 'string' && body.modelStorageKey.trim()
      ? body.modelStorageKey.trim()
      : null;

  const attachmentsFromBody = Array.isArray(body.attachments)
    ? body.attachments
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
        }))
    : [];

  const legacyKeys = Array.isArray(body.attachmentStorageKeys)
    ? body.attachmentStorageKeys.filter((k) => typeof k === 'string' && k.trim())
    : [];

  const attachments =
    attachmentsFromBody.length > 0
      ? attachmentsFromBody
      : [
          ...(imageStorageKey ? [{ storageKey: imageStorageKey, is3D: false }] : []),
          ...(modelStorageKey ? [{ storageKey: modelStorageKey, is3D: true }] : []),
          ...legacyKeys.map((storageKey) => ({
            storageKey,
            is3D: storageKey.includes('/models') || storageKey.endsWith('.glb'),
          })),
        ];

  return proxyLayout(req, '/api/v1/catalog/skus', {
    method: 'POST',
    body: {
      categoryId,
      subCategoryId: body.subCategoryId ?? null,
      brandId: body.brandId ?? null,
      variant: body.variant ?? null,
      size: body.size ?? null,
      name,
      code,
      barcode: body.barcode ?? null,
      pack: body.pack ?? null,
      netContent: body.netContent ?? null,
      storageType: body.storageType ?? null,
      shelfLifeDays: body.shelfLifeDays ?? null,
      imageStorageKey,
      modelStorageKey,
      width: toNum(body.width),
      height: toNum(body.height),
      depth: toNum(body.depth),
      attachments,
      status: body.status ?? 'active',
      isHero: body.isHero === true || body.heroSku === true,
      isStackable:
        body.isStackable === false || body.stackable === false ? false : true,
    },
  });
}
