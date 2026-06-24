import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

const API_BASE_URL = process.env.API_BASE_URL;

export async function GET(req: NextRequest) {
    try {
        const token = await getToken(req);

        if (!token) {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401, data: null },
                { status: 401 }
            );
        }

        const response = await fetch(
            `${API_BASE_URL}/ProductApi/IBrandFeature/ListBrands`,
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
            const errorText = await response.text();
            console.error(`[ListBrands] Backend error (${response.status}):`, errorText);
            return NextResponse.json(
                {
                    isRequestSuccess: false,
                    message: errorText || `Backend returned ${response.status}`,
                    statusCode: response.status,
                    data: null
                },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('[ListBrands] Expected JSON but got:', text);
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Invalid response format from backend', statusCode: 502, data: null },
                { status: 502 }
            );
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('[ListBrands] SSR error:', error);
        return NextResponse.json(
            { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500, data: null },
            { status: 500 }
        );
    }
}
