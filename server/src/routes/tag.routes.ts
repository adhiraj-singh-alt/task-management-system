import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../validators/common.validator.js";
import { createTagSchema, updateTagSchema } from "../validators/tag.validator.js";
import * as tagController from "../controllers/tag.controller.js";

/**
 * Tags routes (mounted at TAGS_PATH). All require authentication. Tags are a
 * shared, global catalogue: any user may read them, but only ADMINs may
 * create/update/delete.
 */
export const tagRouter = Router();

tagRouter.use(authenticate);

tagRouter.get("/", tagController.list);
tagRouter.get("/:id", validate(idParamSchema, "params"), tagController.get);
tagRouter.post("/", requireRole("ADMIN"), validate(createTagSchema), tagController.create);
tagRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  validate(idParamSchema, "params"),
  validate(updateTagSchema),
  tagController.update,
);
tagRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  validate(idParamSchema, "params"),
  tagController.remove,
);
