import type { NextRequest } from 'next/server';
import { extractList, proxyLayout } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeId = searchParams.get('storeId')?.trim();
  const status = searchParams.get('status')?.trim() ?? 'Active';
  const posmType = searchParams.get('posmType')?.trim();
  const page = searchParams.get('page')?.trim() ?? '1';
  const pageSize = searchParams.get('pageSize')?.trim() ?? '50';

  const qs = new URLSearchParams({ status, page, pageSize });
  if (storeId) qs.set('storeId', storeId);
  if (posmType) qs.set('posmType', posmType);

  const path = `/api/v1/company-assets/posm?${qs}`;

  return proxyLayout(req, path, {
    method: 'GET',
    transform: (data) => {
      const list = extractList(data);
      return {
        items: list.map((p: any) => ({
          id: p.id ?? p.posmItemId,
          name: p.name ?? p.posmName ?? 'POSM item',
          posmType: p.posmType ?? p.type ?? 'ShelfTalker',
          assignedStoresLabel: p.assignedStoresLabel ?? '',
          conditionStandards: p.conditionStandards ?? '',
          status: p.status ?? 'Active',
        })),
      };
    },
  });
}
