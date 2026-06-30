import type { RequestHandler } from "express";
import * as tagService from "../services/tag.service.js";

/** Tags controllers — HTTP only. Shared catalogue exposed read-only. */

export const list: RequestHandler = async (_req, res) => {
  const tags = await tagService.list();
  res.json({ tags });
};
