import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("gi.auth.token", "mock-e2e-token");
    window.localStorage.setItem("gi.auth.email", "test@example.com");
  });
});

test("keeps onboarding local and makes no backend requests in mock mode", async ({ page }) => {
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/")) {
      backendRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Find grants for my organisation" })).toBeVisible();

  await page.getByRole("button", { name: "Find grants for my organisation" }).click();
  await expect(
    page.getByRole("heading", { name: "Tell me about your organisation" }),
  ).toBeVisible();
  expect(backendRequests).toEqual([]);
});

test("renders the application pipeline without runtime crashes", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Views" })
    .getByRole("button", { name: "Pipeline" })
    .click();

  await expect(page.getByRole("heading", { level: 2, name: "Application pipeline" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open$/ }).first()).toBeVisible();
  expect(pageErrors).toEqual([]);
});
