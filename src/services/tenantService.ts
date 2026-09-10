import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { ConflictError, NotFoundError } from "../errors/AppError";
import type { CreateTenantInput } from "../schemas/tenantSchemas";

export async function listTenants() {
  return prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
}

/** Usado por los endpoints publicos (sin sesion) para resolver a que tenant se refieren. */
export async function getActiveTenantBySlug(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || !tenant.isActive) {
    throw new NotFoundError("Tenant");
  }
  return tenant;
}

/**
 * Crea un tenant y, en la misma transaccion, su primer TENANT_ADMIN — sin
 * esto el tenant quedaria sin nadie que pueda administrarlo.
 */
export async function createTenantWithAdmin(input: CreateTenantInput) {
  const existingSlug = await prisma.tenant.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new ConflictError(`Ya existe un tenant con slug "${input.slug}"`);
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: input.adminEmail } });
  if (existingEmail) {
    throw new ConflictError(`Ya existe un usuario con el correo "${input.adminEmail}"`);
  }

  const passwordHash = await hashPassword(input.adminPassword);

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: input.name, slug: input.slug } });
    const admin = await tx.user.create({
      data: { email: input.adminEmail, passwordHash, role: "TENANT_ADMIN", tenantId: tenant.id },
    });
    return {
      tenant,
      admin: { id: admin.id, email: admin.email, role: admin.role },
    };
  });
}

export async function setTenantActive(tenantId: string, isActive: boolean) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new NotFoundError("Tenant");
  }
  return prisma.tenant.update({ where: { id: tenantId }, data: { isActive } });
}
