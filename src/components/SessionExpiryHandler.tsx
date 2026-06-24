"use client";

import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { logout } from "@verseye/auth-client";

/**
 * Globally watches every fetch() to our own /api routes. When the backend
 * reports 401 (session expired / token mismatch), it logs the user out
 * (clears localStorage + the httpOnly cookie) and redirects to /login.
 *
 * Implemented as a one-time fetch wrapper so existing components keep using
 * plain fetch() without any changes.
 */
export default function SessionExpiryHandler() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        const w = window as typeof window & { __sessionExpiryPatched?: boolean };
        if (w.__sessionExpiryPatched) return;
        w.__sessionExpiryPatched = true;

        const originalFetch = window.fetch.bind(window);
        let handlingExpiry = false;

        const resolveUrl = (input: RequestInfo | URL): string => {
            try {
                if (typeof input === "string") return input;
                if (input instanceof URL) return input.toString();
                if (input instanceof Request) return input.url;
            } catch {
                /* ignore */
            }
            return "";
        };

        const isAuthExempt = (url: string): boolean =>
            url.includes("/api/login") || url.includes("/api/logout");

        const isOwnApi = (url: string): boolean => {
            if (url.startsWith("/api/")) return true;
            try {
                const parsed = new URL(url, window.location.origin);
                return (
                    parsed.origin === window.location.origin &&
                    parsed.pathname.startsWith("/api/")
                );
            } catch {
                return false;
            }
        };

        const handleExpiry = async () => {
            if (handlingExpiry) return;
            handlingExpiry = true;

            if (window.location.pathname !== "/login") {
                toast.error("Session expired. Please sign in again.");
            }

            try {
                await logout();
            } finally {
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                }
            }
        };

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const response = await originalFetch(input, init);

            if (response.status === 401) {
                const url = resolveUrl(input);
                if (isOwnApi(url) && !isAuthExempt(url)) {
                    void handleExpiry();
                }
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
            w.__sessionExpiryPatched = false;
        };
    }, []);

    return null;
}
