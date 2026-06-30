import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/authenticate.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";
import * as authController from "../controllers/auth.controller.js";

/** Auth routes. Mounted at AUTH_PATH (see routes/index.ts). Wiring only. */
export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), authController.register);
authRouter.post("/login", validate(loginSchema), authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, authController.me);
