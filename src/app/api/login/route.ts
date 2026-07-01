import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL;

const TOKEN_KEYS = ['token', 'accessToken', 'jwt', 'authToken', 'idToken', 'bearerToken'] as const;

function pickToken(rec: Record<string, unknown> | null | undefined): string | null {
    if (!rec) return null;
    for (const k of TOKEN_KEYS) {
        const v = rec[k];
        if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
}

// Resolves the access token from common login response shapes
// ({ token }, { accessToken }, { data: { ... } }, { data: { session: { ... } } }, ...).
function extractToken(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const root = body as Record<string, unknown>;

    const fromRoot = pickToken(root);
    if (fromRoot) return fromRoot;

    const data = root.data;
    if (data && typeof data === 'object') {
        const d = data as Record<string, unknown>;
        const fromData = pickToken(d);
        if (fromData) return fromData;
        for (const n of ['session', 'result', 'payload', 'auth'] as const) {
            const inner = d[n];
            if (inner && typeof inner === 'object') {
                const t = pickToken(inner as Record<string, unknown>);
                if (t) return t;
            }
        }
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!API_BASE_URL) {
            return NextResponse.json({ message: 'Server configuration error' }, { status: 500 });
        }

        const backendUrl = `${API_BASE_URL}/api/v1/auth/login`;

        const backendRes = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const text = await backendRes.text();
        let body: any = {};
        if (text) {
            try {
                body = JSON.parse(text);
            } catch {
                body = { message: text };
            }
        }

        if (!backendRes.ok) {
            return NextResponse.json(
                { message: body?.message || body?.title || 'Login failed' },
                { status: backendRes.status }
            );
        }

        const token = extractToken(body);

        const res = NextResponse.json(body);
        if (token) {
            const isProduction = process.env.NODE_ENV === 'production';
            const isHttps = req.url.startsWith('https://');

            res.cookies.set('planogram_token', token, {
                httpOnly: true,
                path: '/',
                sameSite: 'lax',
                secure: isProduction && isHttps,
                maxAge: 60 * 60 * 24 * 7, // 7 days
            });
        } else {
            console.warn('[login] No token found in auth response body');
        }

        return res;
    } catch (error) {
        console.error('[login] Unexpected error:', error);
        return NextResponse.json({ message: 'Unexpected error during login' }, { status: 500 });
    }
}
