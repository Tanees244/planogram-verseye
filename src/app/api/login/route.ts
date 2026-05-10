import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        // Use AUTH_URL from .env (port 8030)
        const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL;
        const backendUrl = `${authBaseUrl}/Auth/IAuthFeature/Login`;

        if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
            console.log('[login] Auth backend URL:', backendUrl);
        }

        const backendRes = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const body = await backendRes.json();

        if (!backendRes.ok) {
            return NextResponse.json({ message: body.message || 'Login failed' }, { status: backendRes.status });
        }

        const token = body?.token || body?.data?.token;

        const res = NextResponse.json(body);
        if (token) {
            const isProduction = process.env.NODE_ENV === 'production';
            const isHttps = req.url.startsWith('https://');

            console.log('[login] Setting token cookie:', {
                hasToken: !!token,
                tokenLength: token.length,
                isProduction,
                isHttps,
                secure: isProduction && isHttps
            });

            res.cookies.set('planogram_token', token, {
                httpOnly: true,
                path: '/',
                sameSite: 'lax',
                secure: isProduction && isHttps,
                maxAge: 60 * 60 * 24 * 7, // 7 days
            });
            if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
                console.log('[login] Cookie set successfully');
            }
        } else {
            console.warn('[login] No token in response body');
        }

        return res;
    } catch (error) {
        console.error('[login] Unexpected error:', error);
        return NextResponse.json({ message: 'Unexpected error during login' }, { status: 500 });
    }
}
