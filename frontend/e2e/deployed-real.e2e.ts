import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const deployedBaseURL = process.env.DEPLOYED_BASE_URL;
const runRealBedrock = process.env.RUN_REAL_BEDROCK_E2E === "true";

test.skip(!deployedBaseURL, "Set DEPLOYED_BASE_URL to run deployed real-environment tests.");

async function registerE2EUser(request: APIRequestContext) {
  const timestamp = Date.now();
  const email = `e2e-${timestamp}@example.com`;
  const password = `E2E-${timestamp}-password`;

  const response = await request.post("/api/v1/auth/register", {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();

  const payload = (await response.json()) as { token: string };
  expect(payload.token).toBeTruthy();
  return { email, password, token: payload.token };
}

async function openAuthenticatedApp(page: Page, token: string) {
  await page.addInitScript((authToken) => {
    window.localStorage.setItem("gi.auth.token", authToken);
  }, token);
  await page.goto("/");
}

test("deployed app serves frontend and backend health without mocked API routes", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/v1/health");
  expect(health.status()).toBe(200);
  await expect(health).toHaveJSON({ status: "ok" });

  const { token } = await registerE2EUser(request);
  await openAuthenticatedApp(page, token);

  await expect(page.getByText("Grant Intelligence")).toBeVisible();
  await expect(page.getByText(/Connected · Backend v/i)).toBeVisible();
});

test("deployed chat without profile context collects information instead of failing", async ({
  request,
}) => {
  const { token } = await registerE2EUser(request);
  const headers = { Authorization: `Bearer ${token}` };

  const conversation = await request.post("/api/v1/chat/conversations", { headers });
  expect(conversation.status()).toBe(200);
  const conversationPayload = (await conversation.json()) as { conversation_id: string };

  const message = await request.post("/api/v1/chat/message", {
    headers,
    data: {
      conversation_id: conversationPayload.conversation_id,
      user_message: "helo",
    },
  });
  expect(message.status()).toBe(200);
  const payload = (await message.json()) as {
    next_step: string;
    tool_results: unknown[];
  };
  expect(payload.next_step).toBe("collect_information");
  expect(payload.tool_results).toEqual([]);
});

test("deployed grant search reaches the real backend agent path", async ({ request }) => {
  test.skip(
    !runRealBedrock,
    "Set RUN_REAL_BEDROCK_E2E=true to run the real Bedrock-backed grant search.",
  );

  const { token } = await registerE2EUser(request);
  const response = await request.post("/api/v1/grants/search", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      query: "robotics",
      country: "Germany",
      organization_type: "SME",
      only_open: true,
      limit: 1,
    },
    timeout: 60_000,
  });

  expect(response.status()).toBe(200);
  const payload = (await response.json()) as {
    grants: unknown[];
    source_summary: string;
  };
  expect(Array.isArray(payload.grants)).toBe(true);
  expect(payload.source_summary).toContain("Bedrock-backed grant agent");
});
