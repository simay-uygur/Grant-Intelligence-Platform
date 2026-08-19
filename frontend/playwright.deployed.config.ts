import { defineConfig, devices } from "@playwright/test";

const deployedBaseURL = process.env.DEPLOYED_BASE_URL || "http://127.0.0.1:9";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/deployed-real.e2e.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: deployedBaseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
