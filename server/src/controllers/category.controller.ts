import type { RequestHandler } from "express";
import * as categoryService from "../services/category.service.js";
import { validated } from "../utils/request.js";
import type { IdParam } from "../validators/common.validator.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../validators/category.validator.js";

/** Categories controllers — HTTP only. Shared catalogue: reads open to any
 *  authenticated user, writes gated to ADMIN in the routes. */

export const list: RequestHandler = async (_req, res) => {
  const categories = await categoryService.list();
  res.json({ categories });
};

export const get: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  const category = await categoryService.getById(id);
  res.json({ category });
};

export const create: RequestHandler = async (req, res) => {
  const category = await categoryService.create(validated<CreateCategoryInput>(req));
  res.status(201).json({ category });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  const category = await categoryService.update(id, validated<UpdateCategoryInput>(req));
  res.json({ category });
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  await categoryService.remove(id);
  res.status(204).send();
};
