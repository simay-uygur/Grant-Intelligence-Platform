import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Deliberately standalone rather than reusing vite.config.ts: that config
 * pulls in the TanStack Start / nitro / Tailwind plugin chain, none of which
 * a pure-logic test run needs (and which would make the run slow and fragile).
 *
 * `environment: "node"` because every test here is pure — no DOM, no React
 * rendering. Add jsdom only when a test genuinely needs a document.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the "@/*" -> "./src/*" path alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
