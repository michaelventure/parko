import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  // Solo aplica cuando lo crea un TENANT_ADMIN; un SUPER_ADMIN siempre
  // recibe una key SUPER_ADMIN sin importar esto.
  role: z.enum(["TENANT_ADMIN", "TENANT_USER"]).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
