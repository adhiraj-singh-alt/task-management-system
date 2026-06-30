import type { RequestHandler } from "express";
import * as categoryService from "../services/category.service.js";

/** Categories controllers — HTTP only. Shared catalogue exposed read-only. */

export const list: RequestHandler = async (_req, res) => {
  const categories = await categoryService.list();
  res.json({ categories });
};
