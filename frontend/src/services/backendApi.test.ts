import { describe, expect, test } from "vitest";
import { BackendApiContractError, parseBackendInfo, parseHealthResponse } from "./backendApi";

describe("backend bootstrap API mapping", () => {
  test("accepts a healthy backend response", () => {
    expect(parseHealthResponse({ status: "ok" })).toBeUndefined();
  });

  test("rejects unhealthy and malformed health responses", () => {
    expect(() => parseHealthResponse({ status: "degraded" })).toThrow(BackendApiContractError);
    expect(() => parseHealthResponse({})).toThrow(BackendApiContractError);
  });

  test("maps validated frontend configuration", () => {
    expect(
      parseBackendInfo({
        app_name: "Grant Intelligence Backend",
        api_prefix: "/api/v1",
        version: "0.1.0",
        cors_origins: ["http://127.0.0.1:5173"],
        endpoints: [
          {
            name: "health",
            method: "GET",
            path: "/api/v1/health",
            purpose: "Connectivity check",
          },
        ],
      }),
    ).toEqual({
      appName: "Grant Intelligence Backend",
      apiPrefix: "/api/v1",
      version: "0.1.0",
    });
  });

  test("rejects malformed frontend configuration", () => {
    expect(() =>
      parseBackendInfo({
        app_name: "Grant Intelligence Backend",
        api_prefix: "/api/v1",
        version: "",
        cors_origins: [],
        endpoints: [],
      }),
    ).toThrow(BackendApiContractError);
  });
});
