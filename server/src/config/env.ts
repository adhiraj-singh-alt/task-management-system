import "dotenv/config";
import { z } from "zod";

/**
 * Validated, typed environment. Import `env` anywhere instead of reaching for
 * `process.env`. Invalid/missing config fails fast at startup.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // Comma-separated list of allowed origins, or "*" to allow all.
  CORS_ORIGIN: z.string().default("*"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // --- Auth ---
  // Secret used to sign access-token JWTs. Required (no default) so the app fails fast.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  // Access-token lifetime in the jsonwebtoken/ms format (e.g. "15m", "1h").
  JWT_ACCESS_TTL: z.string().default("15m"),
  // Refresh-token lifetime in days — drives both the DB expiresAt and cookie maxAge.
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // bcrypt cost factor.
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  // Cookie name carrying the refresh token.
  REFRESH_COOKIE_NAME: z.string().default("refresh_token"),

  // --- Logging ---
  // pino log level. Defaults applied per-environment in src/lib/logger.ts.
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .optional(),

  // --- Cache (Redis) ---
  // Connection string for an externally-run Redis. Absent => caching is disabled
  // (every cache op no-ops), so the app runs identically without Redis.
  REDIS_URL: z.url().optional(),
  // Master kill-switch. Note: a plain string env can't use z.coerce.boolean()
  // (it would treat "false" as truthy), so parse the literal explicitly.
  CACHE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Data-key TTL in seconds — the orphan-reaper for version-superseded keys and a
  // safety net for any missed invalidation. Version counters themselves never expire.
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";

/**
 * Caching is active only when explicitly enabled AND a Redis URL is configured.
 * Gating on REDIS_URL presence keeps the cache a clean no-op wherever it isn't
 * set (notably the vitest suite, which configures no REDIS_URL).
 */
export const cacheEnabled = env.CACHE_ENABLED && !!env.REDIS_URL;
