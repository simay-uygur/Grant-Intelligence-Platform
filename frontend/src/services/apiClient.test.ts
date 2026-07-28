import { describe, expect, test } from "bun:test";
import { ApiClient, ApiError, joinApiUrl } from "./apiClient";

describe("ApiClient", () => {
  test("normalizes base URL and endpoint slashes", () => {
    expect(joinApiUrl("http://localhost:8000/", "/api/v1/grants/search")).toBe(
      "http://localhost:8000/api/v1/grants/search",
    );
    expect(joinApiUrl(undefined, "api/v1/grants/search")).toBe(
      "/api/v1/grants/search",
    );
  });

  test("surfaces FastAPI error details", async () => {
    const client = new ApiClient(
      "http://localhost:8000",
      async () =>
        new Response(JSON.stringify({ detail: "Search is unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
    );

    try {
      await client.request("/api/v1/grants/search");
      throw new Error("Expected the request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(503);
      expect((error as Error).message).toBe("Search is unavailable");
    }
  });

  test("normalizes network failures", async () => {
    const client = new ApiClient("http://localhost:8000", async () => {
      throw new TypeError("connection refused");
    });

    expect(client.request("/api/v1/grants/search")).rejects.toThrow(
      "Unable to reach the grant backend. Check that it is running and try again.",
    );
  });

  test("rejects successful responses that are not JSON", async () => {
    const client = new ApiClient(
      "http://localhost:8000",
      async () => new Response("not-json", { status: 200 }),
    );

    expect(client.request("/api/v1/grants/search")).rejects.toThrow(
      "The grant backend returned an invalid JSON response.",
    );
  });
});
