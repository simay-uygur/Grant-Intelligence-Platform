import { describe, expect, test } from "vitest";
import {
  ApiClient,
  ApiError,
  AUTH_UNAUTHORIZED_EVENT,
  getApiBaseUrl,
  joinApiUrl,
} from "./apiClient";

describe("ApiClient", () => {
  test("normalizes base URL and endpoint slashes", () => {
    expect(joinApiUrl("http://localhost:8000/", "/api/v1/grants/search")).toBe(
      "http://localhost:8000/api/v1/grants/search",
    );
    expect(joinApiUrl(undefined, "api/v1/grants/search")).toBe("/api/v1/grants/search");
  });

  test("defaults API mode to the local backend during development", () => {
    const env = import.meta.env as Record<string, string | boolean | undefined>;
    const originalBaseUrl = env.VITE_API_URL;
    const originalDev = env.DEV;
    env.VITE_API_URL = "";
    env.DEV = true;

    try {
      expect(getApiBaseUrl()).toBe("http://127.0.0.1:8000");
    } finally {
      env.VITE_API_URL = originalBaseUrl;
      env.DEV = originalDev;
    }
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

    await expect(client.request("/api/v1/grants/search")).rejects.toThrow(
      "Unable to reach the grant backend. Check that it is running and try again.",
    );
  });

  test("rejects successful responses that are not JSON", async () => {
    const client = new ApiClient(
      "http://localhost:8000",
      async () => new Response("not-json", { status: 200 }),
    );

    await expect(client.request("/api/v1/grants/search")).rejects.toThrow(
      "The grant backend returned an invalid JSON response.",
    );
  });

  test("clears token and dispatches unauthorized event on 401 response", async () => {
    const storage = new Map<string, string>();
    storage.set("gi.auth.token", "old-token");
    let eventFired = false;

    const mockWindow = {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
        removeItem: (k: string) => storage.delete(k),
      },
      dispatchEvent: (event: { type: string }) => {
        if (event.type === AUTH_UNAUTHORIZED_EVENT) eventFired = true;
        return true;
      },
    };

    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = mockWindow;

    const client = new ApiClient(
      "http://localhost:8000",
      async () =>
        new Response(JSON.stringify({ detail: "Invalid or expired token." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
    );

    try {
      await client.request("/api/v1/chats/123/messages");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
    } finally {
      if (originalWindow !== undefined) {
        (globalThis as unknown as { window: unknown }).window = originalWindow;
      } else {
        delete (globalThis as unknown as { window?: unknown }).window;
      }
    }

    expect(storage.get("gi.auth.token")).toBeUndefined();
    expect(eventFired).toBe(true);
  });

  test("requestSse streams events and resolves final result data", async () => {
    const sseBody = [
      'data: {"event": "thinking", "stage": "keywords", "message": "Analyzing profile..."}\n\n',
      'data: {"event": "progress", "stage": "search", "message": "Searching..."}\n\n',
      'data: {"event": "result", "stage": "select", "data": {"items": [1, 2, 3]}}\n\n',
    ].join("");

    const receivedEvents: unknown[] = [];
    const client = new ApiClient(
      "http://localhost:8000",
      async () =>
        new Response(sseBody, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
    );

    const result = await client.requestSse<{ items: number[] }>(
      "/api/v1/grants/search/stream",
      { method: "POST" },
      (event) => receivedEvents.push(event),
    );

    expect(receivedEvents).toHaveLength(3);
    expect(result).toEqual({ items: [1, 2, 3] });
  });
});
