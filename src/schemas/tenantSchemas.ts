import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug: solo minusculas, numeros y guiones"),
  adminEmail: z.string().trim().email(),
  adminPassword: z.string().min(8, "la contraseña debe tener al menos 8 caracteres"),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
