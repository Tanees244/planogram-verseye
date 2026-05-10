import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@/app/api/utils/getToken';

const API_BASE_URL = process.env.API_BASE_URL;

interface RemoveRackRequest {
    rackId: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: RemoveRackRequest = await req.json();
        const token = await getToken(req);

        if (!token) {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 },
                { status: 401 }
            );
        }

        const { rackId } = body;

        if (!rackId || typeof rackId !== 'string') {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'rackId is required', statusCode: 400 },
                { status: 400 }
            );
        }
        
        const response = await fetch(
            `${API_BASE_URL}/IRackStructureFeature/RemoveRack`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ rackId }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[RemoveRack] Backend error (${response.status}):`, errorText);
            return NextResponse.json(
                {
                    isRequestSuccess: false,
                    message: errorText || `Backend returned ${response.status}`,
                    statusCode: response.status
                },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            return NextResponse.json(
                { isRequestSuccess: true, message: 'Rack removed successfully (non-JSON response)', data: text },
                { status: 200 }
            );
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });

    } catch (error) {
        console.error('RemoveRack SSR Error:', error);
        return NextResponse.json(
            { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
            { status: 500 }
        );
    }
}
