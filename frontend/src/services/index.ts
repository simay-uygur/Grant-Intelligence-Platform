import { ApiGrantService } from "./ApiGrantService";
import { ApiBackendService } from "./ApiBackendService";
import { ApiChatService } from "./ApiChatService";
import type { ApplicationService } from "./ApplicationService";
import type { BackendService } from "./BackendService";
import type { ChatService } from "./ChatService";
import type { GrantService } from "./GrantService";
import { LocalApplicationService } from "./LocalApplicationService";
import { MockGrantService } from "./MockGrantService";
import { ApiClient } from "./apiClient";

const mode = (import.meta.env.VITE_API_MODE as string | undefined) ?? "mock";
// Only read/used when mode === "api" — mock mode never touches this and
// never makes a network request.
const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;
const apiClient = mode === "api" ? new ApiClient(apiBaseUrl) : undefined;

export const grantService: GrantService =
  mode === "api" && apiClient ? new ApiGrantService(apiBaseUrl, apiClient) : new MockGrantService();
export const applicationService: ApplicationService = new LocalApplicationService();
export const chatService: ChatService | undefined = apiClient
  ? new ApiChatService(apiClient)
  : undefined;
export const backendService: BackendService | undefined = apiClient
  ? new ApiBackendService(apiClient)
  : undefined;

export const isMockMode = mode !== "api";
export type { ApplicationService, BackendService, ChatService, GrantService };
