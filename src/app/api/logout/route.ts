import { NextResponse } from 'next/server';
import { AUTH_COOKIES, LEGACY_COOKIE } from '../utils/getToken';

export async function POST() {
    const res = NextResponse.json({ isRequestSuccess: true, message: 'Logged out' });
    for (const name of [...AUTH_COOKIES, LEGACY_COOKIE]) {
        res.cookies.set(name, '', {
            httpOnly: true,
            path: '/',
            sameSite: 'lax',
            maxAge: 0,
        });
    }
    return res;
}
