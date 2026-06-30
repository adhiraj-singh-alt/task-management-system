import { Router } from "express";
import {
  AUTH_PATH,
  TASKS_PATH,
  CATEGORIES_PATH,
  TAGS_PATH,
  USERS_PATH,
  REPORTS_PATH,
  METRICS_PATH,
} from "../constants/routes.js";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "./auth.routes.js";
import { taskRouter } from "./task.routes.js";
import { categoryRouter } from "./category.routes.js";
import { tagRouter } from "./tag.routes.js";
import { userRouter } from "./user.routes.js";
import { reportRouter } from "./report.routes.js";
import { metricRouter } from "./metric.routes.js";

/**
 * Aggregates every feature router behind one mountable router. Feature routers
 * use relative paths and get their versioned `/api/v1/...` prefix here; mount
 * new modules (reports, ...) by adding a line below.
 */
export const apiRouter = Router();

// Health is intentionally unversioned (liveness/readiness probes hit /health
// and /api/health directly — see health.routes.ts).
apiRouter.use(healthRouter);
apiRouter.use(AUTH_PATH, authRouter);
apiRouter.use(TASKS_PATH, taskRouter);
apiRouter.use(CATEGORIES_PATH, categoryRouter);
apiRouter.use(TAGS_PATH, tagRouter);
apiRouter.use(USERS_PATH, userRouter);
apiRouter.use(REPORTS_PATH, reportRouter);
apiRouter.use(METRICS_PATH, metricRouter);
