import { z } from "zod";

/** Body schemas for the Tags endpoints. */

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
});

export const updateTagSchema = createTagSchema.partial();

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
