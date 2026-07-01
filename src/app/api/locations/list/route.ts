import type { NextRequest } from 'next/server';
import { proxyLayout, extractList } from '@/app/api/utils/layoutProxy';

// Stores are modelled as "branches" in the new catalog API. The branch id is the
// storeId used when creating racks. We map them into the { locations: [...] }
// shape the existing rack form expects ({ id, locationCode }).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') ?? '1';
  const pageSize = searchParams.get('pageSize') ?? '100';
  const search = searchParams.get('search') ?? '';
  const regionId = searchParams.get('regionId') ?? '';

  const qs = new URLSearchParams({ page, pageSize });
  if (search) qs.set('search', search);
  if (regionId) qs.set('regionId', regionId);

  return proxyLayout(req, `/api/v1/locations/branches?${qs.toString()}`, {
    method: 'GET',
    transform: (data) => ({
      locations: extractList(data).map((b: any) => ({
        id: b.id ?? b.branchId ?? b.storeId,
        locationCode:
          b.name ?? b.branchName ?? b.code ?? b.locationCode ?? b.storeName ?? b.id,
        ...b,
      })),
    }),
  });
}
