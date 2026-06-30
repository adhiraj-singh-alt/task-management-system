import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import * as tagController from "../controllers/tag.controller.js";

/**
 * Tags routes (mounted at TAGS_PATH). All require authentication. Tags are a
 * shared, global catalogue exposed read-only — only the list endpoint the
 * frontend consumes is served; catalogue rows are managed via seeding/DB.
 */
export const tagRouter = Router();

tagRouter.use(authenticate);

tagRouter.get("/", tagController.list);
