import { z } from "zod";
import type { BackendInfo } from "./BackendService";

const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

const frontendConfigResponseSchema = z.object({
  app_name: z.string().min(1),
  api_prefix: z.string().min(1),
  version: z.string().min(1),
  cors_origins: z.array(z.string()),
  endpoints: z.array(
    z.object({
      name: z.string(),
      method: z.string(),
      path: z.string(),
      purpose: z.string(),
    }),
  ),
});

export class BackendApiContractError extends Error {
  constructor() {
    super("The backend status response did not match the expected schema.");
    this.name = "BackendApiContractError";
  }
}

export function parseHealthResponse(payload: unknown): void {
  if (!healthResponseSchema.safeParse(payload).success) {
    throw new BackendApiContractError();
  }
}

export function parseBackendInfo(payload: unknown): BackendInfo {
  const parsed = frontendConfigResponseSchema.safeParse(payload);
  if (!parsed.success) throw new BackendApiContractError();
  return {
    appName: parsed.data.app_name,
    apiPrefix: parsed.data.api_prefix,
    version: parsed.data.version,
  };
}
