import { defineConfig, devices } from "@playwright/test";

const host = "127.0.0.1";
const apiPort = 4173;
const mockPort = 4174;
const apiBaseURL = `http://${host}:${apiPort}`;
const mockBaseURL = `http://${host}:${mockPort}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: "list",
  timeout: 45_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "api-mode",
      testMatch: "**/grant-search.e2e.ts",
      use: { ...devices["Desktop Chrome"], baseURL: apiBaseURL },
    },
    {
      name: "mock-mode",
      testMatch: "**/mock-mode.e2e.ts",
      use: { ...devices["Desktop Chrome"], baseURL: mockBaseURL },
    },
  ],
  webServer: [
    {
      command: `bun run dev -- --host ${host} --port ${apiPort} --strictPort`,
      url: apiBaseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_MODE: "api",
        // Keep requests same-origin. Playwright intercepts the API endpoints,
        // while the adapters still exercise their real versioned paths.
        VITE_API_URL: apiBaseURL,
      },
    },
    {
      command: `bun run dev -- --host ${host} --port ${mockPort} --strictPort`,
      url: mockBaseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_MODE: "mock",
        VITE_API_URL: mockBaseURL,
      },
    },
  ],
});
