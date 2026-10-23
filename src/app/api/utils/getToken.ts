import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

/** Cookies issued by the backend login (cookie mode). All are HttpOnly. */
export const AUTH_COOKIES = ['accessToken', 'refreshToken', 'aisleris_user'] as const;
export const ACCESS_COOKIE = 'accessToken';
/** Legacy cookie set by older builds that read the token from the login body. */
export const LEGACY_COOKIE = 'planogram_token';

/**
 * Get authentication token from the backend-issued `accessToken` cookie
 * (falling back to the legacy cookie, then the Authorization header).
 */
export async function getToken(req: NextRequest): Promise<string | null> {
    const cookieStore = await cookies();
    let token = cookieStore.get(ACCESS_COOKIE)?.value ?? cookieStore.get(LEGACY_COOKIE)?.value;

    if (!token) {
        const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    return token || null;
}
