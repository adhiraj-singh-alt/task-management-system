import type { RequestHandler } from "express";
import * as metricService from "../services/metric.service.js";

/** Metrics controllers — HTTP only; ADMIN gating happens in the router. */

export const cache: RequestHandler = async (_req, res) => {
  res.json(await metricService.getCacheMetrics());
};
