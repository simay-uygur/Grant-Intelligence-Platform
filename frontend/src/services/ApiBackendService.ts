import type { BackendInfo, BackendService } from "./BackendService";
import { ApiClient } from "./apiClient";
import { parseBackendInfo, parseHealthResponse } from "./backendApi";

export class ApiBackendService implements BackendService {
  constructor(private readonly client: ApiClient) {}

  async getInfo(): Promise<BackendInfo> {
    const health = await this.client.request<unknown>("/api/v1/health");
    parseHealthResponse(health);
    const config = await this.client.request<unknown>("/api/v1/meta/frontend-config");
    return parseBackendInfo(config);
  }
}
