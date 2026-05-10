import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('planogram_token')?.value;
    const { pathname } = request.nextUrl;

    // Paths that don't require authentication
    const isPublicPath = pathname === '/login' || pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.');

    if (!token && !isPublicPath) {
        // Redirect to login if token is missing and trying to access a protected route
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    if (token && pathname === '/login') {
        // Redirect to home if token is present and trying to access login page
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
