/**
 * Shared utilities.
 * Move from src/lib/utils.ts and src/utils/helpers.ts here.
 */
export { cn } from './cn';

export function getPlanogramTokenFromCookie(): string | null {
	try {
		if (typeof document === 'undefined') return null;
		const m = document.cookie.match(/(?:^|; )planogram_token=([^;]+)/);
		return m && m[1] ? decodeURIComponent(m[1]) : null;
	} catch {
		return null;
	}
}
