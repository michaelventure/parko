import { z } from "zod";

export const createCapacitySchema = z.object({
  totalSpaces: z.number().int().positive(),
});

export type CreateCapacityInput = z.infer<typeof createCapacitySchema>;
