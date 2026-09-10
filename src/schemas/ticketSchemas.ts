import { z } from "zod";
import { MAX_HOURS, MIN_HOURS } from "../services/pricing";

export const createTicketSchema = z.object({
  tenantSlug: z.string().trim().min(1, "tenantSlug es requerido"),
  hours: z
    .number({ invalid_type_error: "hours debe ser un numero" })
    .min(MIN_HOURS, `hours debe ser al menos ${MIN_HOURS}`)
    .max(MAX_HOURS, `hours no puede superar ${MAX_HOURS}`),
  plate: z
    .string()
    .trim()
    .min(3)
    .max(15)
    .optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const ticketIdParamSchema = z.object({
  id: z.string().uuid("id de ticket invalido"),
});
