import { expect, test } from "vitest";
import { ApiBackendService } from "./ApiBackendService";
import { ApiClient } from "./apiClient";

test("checks health and maps frontend bootstrap metadata", async () => {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("/health")) return Response.json({ status: "ok" });
    return Response.json({
      app_name: "Grant Intelligence Backend",
      api_prefix: "/api/v1",
      version: "0.1.0",
      cors_origins: ["http://127.0.0.1:5173"],
      endpoints: [],
    });
  };
  const service = new ApiBackendService(new ApiClient("http://127.0.0.1:8000", fetchImpl));

  await expect(service.getInfo()).resolves.toEqual({
    appName: "Grant Intelligence Backend",
    apiPrefix: "/api/v1",
    version: "0.1.0",
  });
  expect(urls).toEqual([
    "http://127.0.0.1:8000/api/v1/health",
    "http://127.0.0.1:8000/api/v1/meta/frontend-config",
  ]);
});

test("does not request frontend config when health validation fails", async () => {
  const urls: string[] = [];
  const service = new ApiBackendService(
    new ApiClient("http://127.0.0.1:8000", async (input) => {
      urls.push(String(input));
      return Response.json({ status: "degraded" });
    }),
  );

  await expect(service.getInfo()).rejects.toThrow(
    "The backend status response did not match the expected schema.",
  );
  expect(urls).toEqual(["http://127.0.0.1:8000/api/v1/health"]);
});
