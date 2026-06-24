import { NextResponse } from 'next/server';

export async function POST() {
    const res = NextResponse.json({ isRequestSuccess: true, message: 'Logged out' });
    res.cookies.set('planogram_token', '', {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        maxAge: 0,
    });
    return res;
}
