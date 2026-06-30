import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../validators/common.validator.js";
import * as userController from "../controllers/user.controller.js";

/** Users routes (mounted at USERS_PATH). ADMIN only. */
export const userRouter = Router();

userRouter.use(authenticate, requireRole("ADMIN"));

userRouter.get("/", userController.list);
userRouter.get("/:id", validate(idParamSchema, "params"), userController.get);
