import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../validators/common.validator.js";
import * as userController from "../controllers/user.controller.js";

/**
 * Users routes (mounted at USERS_PATH). All require authentication.
 * `GET /assignable` is open to any authenticated user (powers the assignee
 * picker); everything below the `requireRole("ADMIN")` gate is ADMIN-only.
 */
export const userRouter = Router();

userRouter.use(authenticate);

// Any authenticated user — declared before the ADMIN gate (and before "/:id").
userRouter.get("/assignable", userController.listAssignable);

userRouter.use(requireRole("ADMIN"));

userRouter.get("/", userController.list);
userRouter.get("/:id", validate(idParamSchema, "params"), userController.get);
