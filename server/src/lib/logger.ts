import { pino } from "pino";
import { env, isProduction } from "../config/env.js";

/**
 * Shared pino logger. Level resolution:
 *   LOG_LEVEL env > "silent" in test > "info" otherwise.
 * In non-production we pretty-print; in production we emit newline-delimited JSON
 * (the standard for log shippers).
 */
const isTest = env.NODE_ENV === "test";
const level = env.LOG_LEVEL ?? (isTest ? "silent" : "info");

export const logger = pino({
  level,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
        },
      }),
});
