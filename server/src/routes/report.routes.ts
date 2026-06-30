import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { trendQuerySchema } from "../validators/report.validator.js";
import * as reportController from "../controllers/report.controller.js";

/** Reports routes (mounted at REPORTS_PATH). All require authentication. */
export const reportRouter = Router();

reportRouter.use(authenticate);

reportRouter.get("/summary", reportController.summary);
reportRouter.get("/by-category", reportController.byCategory);
reportRouter.get(
  "/completion-trend",
  validate(trendQuerySchema, "query"),
  reportController.completionTrend,
);

// Refreshing the materialized views is an ADMIN operation.
reportRouter.post("/refresh", requireRole("ADMIN"), reportController.refresh);
