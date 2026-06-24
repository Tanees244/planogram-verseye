import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

interface AttachProductRequest {
    binId: string;
    productId: string;
    quantity: number;
}

export async function POST(req: NextRequest) {
    try {
        const body: AttachProductRequest = await req.json();
        const token = await getToken(req);

        if (!token) {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 },
                { status: 401 }
            );
        }

        if (!body?.binId || !body?.productId) {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'binId and productId are required', statusCode: 400 },
                { status: 400 }
            );
        }

        // Using the user-provided endpoint directly as requested
        const response = await fetch(`${process.env.API_BASE_URL}/ProductApi/IBinProductFeature/AttachProductToBin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AttachProductToBin] Backend error (${response.status}):`, errorText);
            return NextResponse.json(
                { isRequestSuccess: false, message: errorText || `Backend returned ${response.status}`, statusCode: response.status },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('AttachProductToBin SSR Error:', error);
        return NextResponse.json(
            { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
            { status: 500 }
        );
    }
}
