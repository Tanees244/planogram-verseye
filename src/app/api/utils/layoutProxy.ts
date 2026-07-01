import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from './getToken';

const API_BASE_URL = process.env.API_BASE_URL;

interface ProxyOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    /** JSON body to forward (object). Omit for GET/DELETE without a body. */
    body?: unknown;
    /** Require a bearer token (defaults to true). */
    requireAuth?: boolean;
    /** Optional mapper applied to the unwrapped payload before responding. */
    transform?: (data: any) => any;
}

/** Unwraps the various success envelopes the backend may use. */
function unwrap(parsed: any): { success: boolean; message?: string; data: any } {
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if ('isRequestSuccess' in parsed) {
            return {
                success: Boolean(parsed.isRequestSuccess),
                message: parsed.message,
                data: 'data' in parsed ? parsed.data : parsed,
            };
        }
        if ('success' in parsed) {
            return {
                success: Boolean(parsed.success),
                message: parsed.message,
                data: parsed.data ?? null,
            };
        }
    }
    return { success: true, data: parsed ?? null };
}

/**
 * Proxies a request to the Store-Layout backend (API_BASE_URL) at the given
 * absolute `path` (e.g. `/api/v1/layout/racks`). It forwards the auth token,
 * normalizes the response to `{ isRequestSuccess, data, ... }` so existing
 * frontend consumers keep working, and returns upstream errors transparently.
 */
export async function proxyLayout(
    req: NextRequest,
    path: string,
    options: ProxyOptions = {}
): Promise<NextResponse> {
    const method = options.method ?? 'GET';
    const requireAuth = options.requireAuth ?? true;

    try {
        if (!API_BASE_URL) {
            console.error(`[proxyLayout ${method} ${path}] API_BASE_URL not set`);
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Server configuration error', statusCode: 500 },
                { status: 500 }
            );
        }

        const token = await getToken(req);
        if (requireAuth && !token) {
            return NextResponse.json(
                { isRequestSuccess: false, message: 'Unauthorized', statusCode: 401 },
                { status: 401 }
            );
        }

        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let payload: string | undefined;
        if (options.body !== undefined) {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(options.body);
        }

        const res = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: payload,
            cache: 'no-store',
        });

        const text = await res.text();
        let data: any = undefined;
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
        }

        if (!res.ok) {
            console.error(`[proxyLayout ${method} ${path}] Backend error ${res.status}:`, text);
            if (payload) {
                console.error(`[proxyLayout ${method} ${path}] Request payload was:`, payload);
            }
            const message =
                (data && typeof data === 'object' && (data.message || data.title)) ||
                (typeof data === 'string' && data) ||
                `Backend returned ${res.status}`;
            return NextResponse.json(
                { isRequestSuccess: false, message, statusCode: res.status, data: null },
                { status: res.status }
            );
        }

        const { success, message, data: inner } = unwrap(data);
        const finalData = options.transform ? options.transform(inner) : inner;

        return NextResponse.json(
            { isRequestSuccess: success, data: finalData, ...(message ? { message } : {}) },
            { status: res.status }
        );
    } catch (error) {
        console.error(`[proxyLayout ${method} ${path}] SSR error:`, error);
        return NextResponse.json(
            { isRequestSuccess: false, message: 'Internal Server Error', statusCode: 500 },
            { status: 500 }
        );
    }
}

/** Extracts an array of items from common backend list/pagination shapes. */
export function extractList(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    return (
        payload.items ??
        payload.results ??
        payload.racks ??
        payload.rows ??
        payload.bins ??
        payload.data ??
        (Array.isArray(payload.value) ? payload.value : []) ??
        []
    );
}
