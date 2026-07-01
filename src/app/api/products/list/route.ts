import type { NextRequest } from 'next/server';
import { proxyLayout, extractList } from '@/app/api/utils/layoutProxy';

// Products are SKUs in the new catalog API. Mapped into the { products: [...] }
// shape the UI expects. The SKU id is what gets attached to bins (skuId).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') ?? '1';
  const pageSize = searchParams.get('pageSize') ?? '100';
  const search = searchParams.get('search') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const subCategoryId = searchParams.get('subCategoryId') ?? '';
  const brandId = searchParams.get('brandId') ?? '';

  const qs = new URLSearchParams({ page, pageSize });
  if (search) qs.set('search', search);
  if (categoryId) qs.set('categoryId', categoryId);
  if (subCategoryId) qs.set('subCategoryId', subCategoryId);
  if (brandId) qs.set('brandId', brandId);

  return proxyLayout(req, `/api/v1/catalog/skus?${qs.toString()}`, {
    method: 'GET',
    transform: (data) => ({
      products: extractList(data).map((s: any) => ({
        id: s.id ?? s.skuId,
        name: s.name ?? s.skuName ?? s.title ?? s.productName,
        categoryId: s.categoryId ?? null,
        brandId: s.brandId ?? null,
        brandName: s.brandName ?? null,
        categoryName: s.categoryName ?? null,
        ...s,
      })),
    }),
  });
}
