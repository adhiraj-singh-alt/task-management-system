import type { RequestHandler } from "express";
import * as reportService from "../services/report.service.js";
import { getAuthUser, validated } from "../utils/request.js";
import type { TrendQuery } from "../validators/report.validator.js";

/** Reports controllers — HTTP only; RBAC scoping happens in the service. */

export const summary: RequestHandler = async (req, res) => {
  res.json(await reportService.getSummary(getAuthUser(req)));
};

export const byCategory: RequestHandler = async (req, res) => {
  res.json(await reportService.getByCategory(getAuthUser(req)));
};

export const completionTrend: RequestHandler = async (req, res) => {
  const { days } = validated<TrendQuery>(req, "query");
  res.json(await reportService.getCompletionTrend(getAuthUser(req), days));
};

export const refresh: RequestHandler = async (_req, res) => {
  const refreshed = await reportService.refreshViews();
  res.json({ refreshed, refreshedAt: new Date().toISOString() });
};
