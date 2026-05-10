/**
 * Auth + API client (authFetch, authApi, usersApi).
 * Shared login flow for frontend apps lives here.
 */

/**
 * Resolve JWT / access token from common backend login payload shapes.
 * Internal users vs super-admins may use different property names (`accessToken`, nested `session`, etc.).
 */
export function extractLoginTokenFromBody(body: unknown): string | null {
  if (body === null || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const keys = ['token', 'accessToken', 'jwt', 'authToken', 'idToken', 'bearerToken'] as const;

  const tryRecord = (rec: Record<string, unknown> | null | undefined): string | null => {
    if (!rec) return null;
    for (const k of keys) {
      const v = rec[k];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
  };

  const fromRoot = tryRecord(root);
  if (fromRoot) return fromRoot;

  const data = root.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const fromData = tryRecord(d);
    if (fromData) return fromData;

    const nested = ['session', 'result', 'payload', 'auth'] as const;
    for (const n of nested) {
      const inner = d[n];
      if (inner && typeof inner === 'object') {
        const t = tryRecord(inner as Record<string, unknown>);
        if (t) return t;
      }
    }
  }

  return null;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const options: RequestInit = { ...init, credentials: 'include' };
  return fetch(input, options);
}

export interface LoginCredentials {
  email: string;
  password: string;
}

interface RawRoleAction {
  actionName?: string | null;
}

interface RawRole {
  actions?: RawRoleAction[] | null;
}

interface RawLoginData {
  user?: unknown;
  token?: string;
  roleAndActions?: RawRole[] | null;
}

interface RawLoginResponseBody {
  message?: string;
  data?: RawLoginData;
  user?: unknown;
  token?: string;
}

export interface LoginResult {
  ok: boolean;
  message?: string;
}

export interface LoginOptions {
  /**
   * Login endpoint relative to the current origin.
   * Defaults to `/api/login`.
   */
  endpoint?: string;
}

function persistLoginState(body: RawLoginResponseBody): void {
  if (typeof window === 'undefined') {
    return;
  }

  const resolvedToken = extractLoginTokenFromBody(body);

  const loginData: RawLoginData = {
    user: body.data?.user ?? body.user,
    token: resolvedToken ?? undefined,
    roleAndActions: body.data?.roleAndActions ?? null,
  };

  const userToStore: unknown = loginData.user ?? (() => {
    const d = body.data as Record<string, unknown> | undefined;
    if (!d) return undefined;
    const { token: _t, refreshToken: _r, roleAndActions: _ra, ...rest } = d;
    return Object.keys(rest).length > 0 ? rest : undefined;
  })();

  try {
    if (userToStore !== undefined) {
      window.localStorage.setItem('user', JSON.stringify(userToStore));
    }
  } catch {
    // ignore storage errors
  }

  try {
    if (typeof loginData.token === 'string' && loginData.token.length > 0) {
      window.localStorage.setItem('authToken', loginData.token);
    } else if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[auth-client] Login succeeded but no token was found in the response body (checked token, accessToken, jwt, nested data). Session may not persist.',
      );
    }
  } catch {
    // ignore storage errors
  }

  const roleAndActions = loginData.roleAndActions ?? [];
  const actionsSet = new Set<string>();

  for (const role of roleAndActions ?? []) {
    if (!role?.actions) continue;
    for (const action of role.actions) {
      if (action?.actionName) {
        actionsSet.add(action.actionName);
      }
    }
  }

  const uniqueActions = Array.from(actionsSet);
  if (uniqueActions.length === 0) {
    return;
  }

  try {
    window.localStorage.setItem('userActions', JSON.stringify(uniqueActions));
  } catch {
    // ignore storage errors
  }
}

export async function loginWithEmailPassword(
  credentials: LoginCredentials,
  options: LoginOptions = {},
): Promise<LoginResult> {
  const endpoint = options.endpoint ?? '/api/login';

  const response = await authFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  // Clone before consuming so Chrome DevTools can still read the response body
  const cloned = response.clone();
  const text = await cloned.text().catch(() => '');

  let parsed: RawLoginResponseBody | string | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as RawLoginResponseBody;
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'message' in parsed && typeof (parsed as RawLoginResponseBody).message === 'string'
        ? (parsed as RawLoginResponseBody).message
        : 'Invalid credentials';

    return {
      ok: false,
      message,
    };
  }

  const body: RawLoginResponseBody =
    typeof parsed === 'object' && parsed !== null ? (parsed as RawLoginResponseBody) : {};

  persistLoginState(body);

  return {
    ok: true,
    message: body.message ?? 'Signed in successfully',
  };
}

