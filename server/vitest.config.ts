import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Force NODE_ENV=test so logging is silenced and rate limiting is skipped.
    env: { NODE_ENV: "test" },
    // Integration tests share one Postgres database — run files serially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
