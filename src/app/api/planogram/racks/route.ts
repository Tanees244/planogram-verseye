import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from '@/app/api/utils/getToken'

const API_BASE_URL = process.env.API_BASE_URL

export async function GET(req: NextRequest) {
  try {
    const token = await getToken(req);
    console.log("TOKEN:", token)
    if (!token) {
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401, data: null },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}/ProductApi/IRackStructureFeature/GetAllRacks`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const text = await response.text()
      console.error('[GetAllRacks] Backend error', response.status, text)
      return NextResponse.json(
        { isRequestSuccess: false, message: text || `Backend returned ${response.status}`, statusCode: response.status },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      const text = await response.text()
      console.error('[GetAllRacks] Expected JSON but got:', text)
      return NextResponse.json(
        { isRequestSuccess: false, message: 'Invalid response format from backend', statusCode: 502 },
        { status: 502 }
      )
    }

    const json = await response.json()
    const data = Array.isArray(json) ? json : json?.data ?? json?.result ?? json
    return NextResponse.json({ isRequestSuccess: true, data }, { status: 200 })
  } catch (error) {
    console.error('GetAllRacks SSR Error:', error)
    return NextResponse.json(
      { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
      { status: 500 }
    )
  }
}
