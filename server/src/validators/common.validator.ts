import { z } from "zod";

/** Shared validators reused across feature modules. */

/** `:id` route param — a UUID. Use with `validate(idParamSchema, "params")`. */
export const idParamSchema = z.object({
  id: z.uuid(),
});

export type IdParam = z.infer<typeof idParamSchema>;

/** Offset-pagination query fields (page/limit) with sane defaults and caps. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
