import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import * as categoryController from "../controllers/category.controller.js";

/**
 * Categories routes (mounted at CATEGORIES_PATH). All require authentication.
 * Categories are a shared, global catalogue exposed read-only — only the list
 * endpoint the frontend consumes is served; catalogue rows are managed via
 * seeding/DB.
 */
export const categoryRouter = Router();

categoryRouter.use(authenticate);

categoryRouter.get("/", categoryController.list);
