import type { RequestHandler } from "express";
import * as userService from "../services/user.service.js";
import { validated } from "../utils/request.js";
import type { IdParam } from "../validators/common.validator.js";

/** Users controllers — admin-only reads (gated by requireRole in the route),
 *  plus a lightweight assignee list open to any authenticated user. */

export const list: RequestHandler = async (_req, res) => {
  const users = await userService.list();
  res.json({ users });
};

export const listAssignable: RequestHandler = async (_req, res) => {
  const users = await userService.listAssignable();
  res.json({ users });
};

export const get: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  const user = await userService.getById(id);
  res.json({ user });
};
