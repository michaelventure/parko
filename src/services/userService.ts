import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { ConflictError } from "../errors/AppError";
import type { CreateTenantUserInput } from "../schemas/userSchemas";

export async function listUsersForTenant(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * El TENANT_ADMIN solo puede crear usuarios dentro de SU propio tenant
 * (tenantId siempre viene de la sesion autenticada, nunca del body) y solo
 * con roles de tenant — nunca puede crear otro SUPER_ADMIN.
 */
export async function createTenantUser(tenantId: string, input: CreateTenantUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError(`Ya existe un usuario con el correo "${input.email}"`);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, role: input.role, tenantId },
  });

  return { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId };
}
