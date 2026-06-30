import type { RequestHandler } from "express";
import * as taskService from "../services/task.service.js";
import { validated, getAuthUser } from "../utils/request.js";
import type { IdParam } from "../validators/common.validator.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
} from "../validators/task.validator.js";

/** Tasks controllers — HTTP only; ownership/RBAC is enforced in the service. */

export const list: RequestHandler = async (req, res) => {
  const result = await taskService.list(getAuthUser(req), validated<ListTasksQuery>(req, "query"));
  res.json(result);
};

export const get: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  const task = await taskService.getById(getAuthUser(req), id);
  res.json({ task });
};

export const create: RequestHandler = async (req, res) => {
  const task = await taskService.create(getAuthUser(req), validated<CreateTaskInput>(req));
  res.status(201).json({ task });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  const task = await taskService.update(getAuthUser(req), id, validated<UpdateTaskInput>(req));
  res.json({ task });
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  await taskService.remove(getAuthUser(req), id);
  res.status(204).send();
};
