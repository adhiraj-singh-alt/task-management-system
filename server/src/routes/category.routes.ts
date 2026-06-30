import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../validators/common.validator.js";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validators/category.validator.js";
import * as categoryController from "../controllers/category.controller.js";

/**
 * Categories routes (mounted at CATEGORIES_PATH). All require authentication.
 * Categories are a shared, global catalogue: any user may read them, but only
 * ADMINs may create/update/delete.
 */
export const categoryRouter = Router();

categoryRouter.use(authenticate);

categoryRouter.get("/", categoryController.list);
categoryRouter.get("/:id", validate(idParamSchema, "params"), categoryController.get);
categoryRouter.post(
  "/",
  requireRole("ADMIN"),
  validate(createCategorySchema),
  categoryController.create,
);
categoryRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  validate(idParamSchema, "params"),
  validate(updateCategorySchema),
  categoryController.update,
);
categoryRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  validate(idParamSchema, "params"),
  categoryController.remove,
);
