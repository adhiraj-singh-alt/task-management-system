import type { RequestHandler } from "express";
import * as tagService from "../services/tag.service.js";
import { validated } from "../utils/request.js";
import type { IdParam } from "../validators/common.validator.js";
import type { CreateTagInput, UpdateTagInput } from "../validators/tag.validator.js";

/** Tags controllers — HTTP only. Shared catalogue: reads open to any
 *  authenticated user, writes gated to ADMIN in the routes. */

export const list: RequestHandler = async (_req, res) => {
  const tags = await tagService.list();
  res.json({ tags });
};

export const get: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  const tag = await tagService.getById(id);
  res.json({ tag });
};

export const create: RequestHandler = async (req, res) => {
  const tag = await tagService.create(validated<CreateTagInput>(req));
  res.status(201).json({ tag });
};

export const update: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  const tag = await tagService.update(id, validated<UpdateTagInput>(req));
  res.json({ tag });
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = validated<IdParam>(req, "params");
  await tagService.remove(id);
  res.status(204).send();
};
