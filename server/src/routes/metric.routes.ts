import { Router } from "express";
import * as metricController from "../controllers/metric.controller.js";

/**
 * Metrics routes (mounted at METRICS_PATH). Public — no auth, so the cache
 * hit/miss ratio can be scraped without a token. (Re-add `authenticate` +
 * `requireRole("ADMIN")` if this should be operator-only.)
 */
export const metricRouter = Router();

// Cache hit/miss ratio, aggregated from audit_logs.
metricRouter.get("/cache", metricController.cache);
