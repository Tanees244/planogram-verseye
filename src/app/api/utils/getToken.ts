import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

/**
 * Get authentication token from either cookie or Authorization header
 * This supports both httpOnly cookies (set by /api/login) and Authorization headers (sent by authFetch)
 */
export async function getToken(req: NextRequest): Promise<string | null> {
    // First, try to get token from httpOnly cookie
    const cookieStore = await cookies();
    let token = cookieStore.get('planogram_token')?.value;

    // Fallback: Check Authorization header if cookie not found
    if (!token) {
        const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    return token || null;
}
