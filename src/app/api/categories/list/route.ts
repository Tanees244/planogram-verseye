import type { NextRequest } from 'next/server';
import { proxyLayout, extractList } from '@/app/api/utils/layoutProxy';

export async function GET(req: NextRequest) {
  return proxyLayout(req, '/api/v1/catalog/categories', {
    method: 'GET',
    transform: (data) => ({
      categories: extractList(data).map((c: any) => ({
        id: c.id ?? c.categoryId,
        name: c.name ?? c.categoryName ?? c.title,
        createdDate: c.createdDate ?? c.createdAt ?? null,
        status: c.status ?? (c.isActive === false ? 'Inactive' : 'Active'),
        ...c,
      })),
    }),
  });
}
