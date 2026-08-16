import { expect, test, type Page, type Route } from "@playwright/test";

const SEARCH_PATH = "/api/v1/grants/search";

const emptySearchResponse = {
  grants: [],
  source_summary: "E2E live Horizon source",
  normalized_filters_applied: {
    query: "Sustainable AI Digital & AI",
    country: "Germany",
    organization_type: "SME",
    only_open: true,
    limit: 3,
  },
};

async function selectOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: new RegExp(label, "i") }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function completeGrantProfile(page: Page) {
  await page.getByRole("button", { name: "Find grants for my organisation" }).click();

  await page.getByRole("textbox", { name: /Organisation name/i }).fill("E2E Labs");
  await selectOption(page, "Organisation type", "SME");
  await selectOption(page, "Country", "Germany");
  await page.getByRole("button", { name: "Continue" }).click();

  await selectOption(page, "Sector", "Digital & AI");
  await page.getByRole("textbox", { name: /Project title/i }).fill("Sustainable AI");
  await page
    .getByRole("textbox", { name: /Project description/i })
    .fill("AI tools that reduce energy use in European manufacturing.");
  await page.getByRole("button", { name: "Continue" }).click();

  await selectOption(page, "Required budget", "€100,000 – €500,000");
  await selectOption(page, "Project duration", "12 months");
}

async function fulfillEmptySearch(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(emptySearchResponse),
  });
}

async function mockBackendServices(
  page: Page,
  options: {
    onChatMessage?: (body: Record<string, unknown>) => void;
    onCreateConversation?: () => void;
    onHistoryRequest?: () => void;
    historyMessages?: Array<Record<string, unknown>>;
    healthStatus?: number;
    conversationStatus?: number;
    chatStatus?: number;
  } = {},
) {
  await page.route("**/api/v1/health", (route) =>
    route.fulfill({
      status: options.healthStatus ?? 200,
      contentType: "application/json",
      body: JSON.stringify(
        options.healthStatus && options.healthStatus >= 400
          ? { detail: "Backend health check unavailable." }
          : { status: "ok" },
      ),
    }),
  );
  await page.route("**/api/v1/meta/frontend-config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        app_name: "Grant Intelligence Backend",
        api_prefix: "/api/v1",
        version: "0.1.0",
        cors_origins: [],
        endpoints: [],
      }),
    }),
  );
  await page.route("**/api/v1/chat/conversations", (route) => {
    options.onCreateConversation?.();
    return route.fulfill({
      status: options.conversationStatus ?? 200,
      contentType: "application/json",
      body: JSON.stringify(
        options.conversationStatus && options.conversationStatus >= 400
          ? { detail: "Conversation service unavailable." }
          : {
              conversation_id: "e2e-backend-conversation",
              created_at: "2026-07-28T20:00:00Z",
              updated_at: "2026-07-28T20:00:00Z",
            },
      ),
    });
  });
  await page.route("**/api/v1/chat/message", async (route) => {
    options.onChatMessage?.(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: options.chatStatus ?? 200,
      contentType: "application/json",
      body: JSON.stringify(
        options.chatStatus && options.chatStatus >= 400
          ? { detail: "Chat response unavailable." }
          : {
              conversation_id: "e2e-backend-conversation",
              assistant_message: "Backend chat is connected.",
              next_step: "collect_information",
              follow_up_questions: [],
              tool_results: [],
            },
      ),
    });
  });
  await page.route("**/api/v1/chat/conversations/*/messages", async (route) => {
    options.onHistoryRequest?.();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        conversation_id: "e2e-backend-conversation",
        messages: options.historyMessages ?? [],
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const initializedKey = "gi.e2e.storage-initialized";
    if (!window.sessionStorage.getItem(initializedKey)) {
      window.localStorage.clear();
      window.sessionStorage.setItem(initializedKey, "true");
    }
    window.localStorage.setItem("gi.auth.token", "mock-e2e-token");
  });
});

test("submits the profile to the versioned grant endpoint and renders empty live results", async ({
  page,
}) => {
  await mockBackendServices(page);
  let submittedBody: Record<string, unknown> | undefined;
  await page.route(`**${SEARCH_PATH}`, async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillEmptySearch(route);
  });

  await page.goto("/");
  await expect(page.getByText("Connected · Backend v0.1.0")).toBeVisible();
  await completeGrantProfile(page);
  await page.getByRole("button", { name: "Research matching grants" }).click();

  await expect(
    page.locator("p").filter({ hasText: "I found 0 live Horizon opportunities for E2E Labs." }),
  ).toBeVisible();
  await expect(page.getByText("No matching grants were found for this profile.")).toBeVisible();
  expect(submittedBody).toEqual({
    query: "Sustainable AI Digital & AI",
    country: "Germany",
    organization_type: "SME",
    only_open: true,
    limit: 3,
  });
  expect(submittedBody).not.toHaveProperty("budget_min");
  expect(submittedBody).not.toHaveProperty("budget_max");
});

test("retries a failed grant search through the real Retry button", async ({ page }) => {
  await mockBackendServices(page);
  let postAttempts = 0;
  await page.route(`**${SEARCH_PATH}`, async (route) => {
    postAttempts += 1;
    if (postAttempts === 1) {
      await route.abort("connectionfailed");
      return;
    }
    await fulfillEmptySearch(route);
  });

  await page.goto("/");
  await completeGrantProfile(page);
  await page.getByRole("button", { name: "Research matching grants" }).click();

  await expect(page.getByRole("heading", { name: "Research failed" })).toBeVisible();
  expect(postAttempts).toBe(1);

  await page.getByRole("button", { name: "Retry", exact: true }).click();

  await expect.poll(() => postAttempts).toBe(2);
  await expect(
    page.locator("p").filter({ hasText: "I found 0 live Horizon opportunities for E2E Labs." }),
  ).toBeVisible();
  await expect(page.getByText("No matching grants were found for this profile.")).toBeVisible();
});

test("creates a backend chat conversation before showing the profile form", async ({ page }) => {
  let chatBody: Record<string, unknown> | undefined;
  await mockBackendServices(page, {
    onChatMessage: (body) => {
      chatBody = body;
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Find grants for my organisation" }).click();

  await expect(page.getByText("Backend chat is connected.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tell me about your organisation" }),
  ).toBeVisible();
  expect(chatBody).toMatchObject({
    conversation_id: "e2e-backend-conversation",
    user_message: "I'd like to find grants for my organisation.",
  });
  expect(chatBody?.session_id).toEqual(expect.any(String));
});

test("shows backend-unavailable status when the health check fails", async ({ page }) => {
  await mockBackendServices(page, { healthStatus: 503 });

  await page.goto("/");

  await expect(page.getByText("Backend unavailable · API mode")).toBeVisible();
});

test("shows a chat API error and keeps the local profile form available", async ({ page }) => {
  await mockBackendServices(page, { conversationStatus: 503 });

  await page.goto("/");
  await page.getByRole("button", { name: "Find grants for my organisation" }).click();

  await expect(page.getByText("Conversation service unavailable.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tell me about your organisation" }),
  ).toBeVisible();
});

test("reuses one backend conversation for later chat messages", async ({ page }) => {
  let createAttempts = 0;
  const chatBodies: Array<Record<string, unknown>> = [];
  await mockBackendServices(page, {
    onCreateConversation: () => {
      createAttempts += 1;
    },
    onChatMessage: (body) => {
      chatBodies.push(body);
    },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Find grants for my organisation" }).click();
  await expect(page.getByText("Backend chat is connected.", { exact: true })).toBeVisible();

  await page.locator("textarea").fill("Here is another project detail.");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect.poll(() => chatBodies.length).toBe(2);
  expect(createAttempts).toBe(1);
  expect(chatBodies.map((body) => body.conversation_id)).toEqual([
    "e2e-backend-conversation",
    "e2e-backend-conversation",
  ]);
  expect(chatBodies[1]?.user_message).toBe("Here is another project detail.");
  expect(chatBodies[1]?.session_id).toBe(chatBodies[0]?.session_id);
});

test("restores missing backend history after reloading a saved conversation", async ({ page }) => {
  let historyRequests = 0;
  await mockBackendServices(page, {
    onHistoryRequest: () => {
      historyRequests += 1;
    },
    historyMessages: [
      {
        message_id: 1,
        conversation_id: "e2e-backend-conversation",
        role: "user",
        content: "An earlier backend question.",
        created_at: "2026-07-28T20:01:00Z",
      },
      {
        message_id: 2,
        conversation_id: "e2e-backend-conversation",
        role: "assistant",
        content: "An earlier backend reply.",
        created_at: "2026-07-28T20:02:00Z",
      },
      {
        message_id: 3,
        conversation_id: "e2e-backend-conversation",
        role: "user",
        content: "Saved local question.",
        created_at: "2026-07-28T20:03:00Z",
      },
      {
        message_id: 4,
        conversation_id: "e2e-backend-conversation",
        role: "assistant",
        content: "Saved local reply.",
        created_at: "2026-07-28T20:04:00Z",
      },
    ],
  });

  await page.goto("/");
  await page.evaluate(() => {
    const conversation = {
      id: "local-saved-conversation",
      backendConversationId: "e2e-backend-conversation",
      title: "Saved conversation",
      createdAt: "2026-07-28T20:00:00Z",
      updatedAt: "2026-07-28T20:04:00Z",
      stage: "collecting_information",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          createdAt: "2026-07-28T20:00:00Z",
          blocks: [{ type: "text", text: "Welcome" }],
        },
        {
          id: "saved-user",
          role: "user",
          createdAt: "2026-07-28T20:03:00Z",
          blocks: [{ type: "text", text: "Saved local question." }],
        },
        {
          id: "saved-assistant",
          role: "assistant",
          createdAt: "2026-07-28T20:04:00Z",
          blocks: [{ type: "text", text: "Saved local reply." }, { type: "structured_form" }],
        },
      ],
    };
    window.localStorage.setItem("gi.conversations.v1", JSON.stringify([conversation]));
    window.localStorage.setItem("gi.activeConversationId.v1", JSON.stringify(conversation.id));
  });

  await page.reload();

  await expect(page.getByText("An earlier backend question.", { exact: true })).toBeVisible();
  await expect(page.getByText("An earlier backend reply.", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved local reply.", { exact: true })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Tell me about your organisation" }),
  ).toBeVisible();
  await expect(page.getByText("History synced", { exact: true })).toBeVisible();
  expect(historyRequests).toBeGreaterThan(0);
});
