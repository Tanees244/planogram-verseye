import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { proxyLayout } from '@/app/api/utils/layoutProxy'

/** POST /api/company-assets/posm → CreatePosmItem */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Invalid JSON body', statusCode: 400 },
      { status: 400 },
    )
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const posmType = typeof body.posmType === 'string' ? body.posmType.trim() : ''
  const status = typeof body.status === 'string' ? body.status.trim() : 'Active'
  const conditionStandards =
    typeof body.conditionStandards === 'string' ? body.conditionStandards.trim() : ''
  const storeIds = Array.isArray(body.storeIds)
    ? body.storeIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []
  const imageStorageKey =
    typeof body.imageStorageKey === 'string' && body.imageStorageKey.trim()
      ? body.imageStorageKey.trim()
      : null

  if (!name || !posmType || !status || storeIds.length === 0) {
    return NextResponse.json(
      {
        isRequestSuccess: false,
        message: 'name, posmType, status, and storeIds are required',
        statusCode: 400,
      },
      { status: 400 },
    )
  }

  return proxyLayout(req, '/api/v1/company-assets/posm', {
    method: 'POST',
    body: {
      name,
      posmType,
      status,
      storeIds,
      conditionStandards: conditionStandards || 'Standard',
      imageStorageKey,
    },
  })
}
