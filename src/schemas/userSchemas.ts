import { z } from "zod";

export const createTenantUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "la contraseña debe tener al menos 8 caracteres"),
  // Un TENANT_ADMIN nunca puede crear un SUPER_ADMIN.
  role: z.enum(["TENANT_ADMIN", "TENANT_USER"]),
});

export type CreateTenantUserInput = z.infer<typeof createTenantUserSchema>;
