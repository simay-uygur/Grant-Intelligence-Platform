/**
 * Normalized API error used by every live service. `status` is undefined for
 * transport failures where no HTTP response was received.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const AUTH_TOKEN_KEY = "gi.auth.token";
const LOCAL_DEV_API_BASE_URL = "http://127.0.0.1:8000";

export const AUTH_UNAUTHORIZED_EVENT = "gi:auth:unauthorized";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  } catch {
    // Storage can be unavailable in private browsing or restricted runtimes.
  }
}

export async function logout(): Promise<void> {
  const token = getAuthToken();
  if (token) {
    const client = new ApiClient(getApiBaseUrl());
    try {
      await client.request("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Best effort notification to backend; proceed to clear local token.
    }
  }
  clearAuthToken();
}

export function joinApiUrl(baseUrl: string | undefined, path: string): string {
  const normalizedBase = (baseUrl ?? "").trim().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function getApiBaseUrl(): string | undefined {
  const configuredBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (configuredBaseUrl) return configuredBaseUrl;
  return import.meta.env.DEV ? LOCAL_DEV_API_BASE_URL : undefined;
}

async function errorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" && body.detail.trim() ? body.detail.trim() : undefined;
  } catch {
    return undefined;
  }
}

export class ApiClient {
  constructor(
    private readonly baseUrl?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = joinApiUrl(this.baseUrl, path);
    const token = getAuthToken();
    let res: Response;
    try {
      // Browser fetch is a Web API method with a Window/Worker receiver.
      // Calling a captured fetch as `this.fetchImpl(...)` passes ApiClient as
      // its receiver and Chrome rejects it with "Illegal invocation" before
      // any network request is made.
      res = await this.fetchImpl.call(globalThis, url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new ApiError(
        "Unable to reach the grant backend. Check that it is running and try again.",
      );
    }

    if (!res.ok) {
      if (res.status === 401) clearAuthToken();
      const detail = await errorDetail(res);
      throw new ApiError(
        detail ?? `Grant backend request failed (${res.status}). Please try again.`,
        res.status,
      );
    }

    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError("The grant backend returned an invalid JSON response.", res.status);
    }
  }
}
