import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("keeps onboarding local and makes no backend requests in mock mode", async ({ page }) => {
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/")) {
      backendRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(page.getByText("Connected · Mock mode")).toBeVisible();

  await page.getByRole("button", { name: "Find grants for my organisation" }).click();
  await expect(
    page.getByRole("heading", { name: "Tell me about your organisation" }),
  ).toBeVisible();
  expect(backendRequests).toEqual([]);
});
