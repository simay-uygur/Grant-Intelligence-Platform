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

export function joinApiUrl(baseUrl: string | undefined, path: string): string {
  const normalizedBase = (baseUrl ?? "").trim().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
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
          ...(localStorage.getItem("gi.auth.token")
            ? { Authorization: `Bearer ${localStorage.getItem("gi.auth.token")}` }
            : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new ApiError(
        "Unable to reach the grant backend. Check that it is running and try again.",
      );
    }

    if (!res.ok) {
      if (res.status === 401) localStorage.removeItem("gi.auth.token");
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
