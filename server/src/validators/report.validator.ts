import { z } from "zod";

/** Query schema for the completion-trend endpoint. */
export const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type TrendQuery = z.infer<typeof trendQuerySchema>;
