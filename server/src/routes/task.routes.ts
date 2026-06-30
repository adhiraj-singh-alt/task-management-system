import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../validators/common.validator.js";
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
} from "../validators/task.validator.js";
import * as taskController from "../controllers/task.controller.js";

/** Tasks routes (mounted at TASKS_PATH). All require authentication. */
export const taskRouter = Router();

taskRouter.use(authenticate);

taskRouter.get("/", validate(listTasksQuerySchema, "query"), taskController.list);
taskRouter.post("/", validate(createTaskSchema), taskController.create);
taskRouter.get("/:id", validate(idParamSchema, "params"), taskController.get);
taskRouter.patch(
  "/:id",
  validate(idParamSchema, "params"),
  validate(updateTaskSchema),
  taskController.update,
);
taskRouter.delete("/:id", validate(idParamSchema, "params"), taskController.remove);
