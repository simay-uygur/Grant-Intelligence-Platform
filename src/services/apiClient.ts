const DEFAULT_BASE_URL = "/api";

/**
 * Minimal fetch boundary for the future FastAPI backend. This is the single
 * seam where cross-cutting API concerns (auth headers, retries, response
 * envelope unwrapping, error normalisation) would be added once a real
 * backend exists — individual service methods should never call `fetch`
 * directly.
 *
 * Only ever constructed by ApiGrantIntelligenceService, which is only used
 * when VITE_API_MODE=api. Mock mode never imports this file, so it makes no
 * network requests.
 *
 * TODO(api): add an Authorization header here once auth is introduced —
 * out of scope for now (see requirements: no auth, no backend connection yet).
 */
export class ApiClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) {
      throw new Error(`API request failed: ${init?.method ?? "GET"} ${path} (${res.status})`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
