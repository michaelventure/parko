import { z } from "zod";

export const createTariffSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ratePerHourCents: z.number().int().positive(),
  dailyMaxCents: z.number().int().positive(),
  currency: z.string().trim().toLowerCase().length(3).default("usd"),
}).refine((data) => data.dailyMaxCents >= data.ratePerHourCents, {
  message: "dailyMaxCents debe ser mayor o igual a ratePerHourCents",
  path: ["dailyMaxCents"],
});

export type CreateTariffInput = z.infer<typeof createTariffSchema>;
