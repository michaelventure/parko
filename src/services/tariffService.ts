import { prisma } from "../lib/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError";
import { getActiveTenantBySlug } from "./tenantService";
import type { CreateTariffInput } from "../schemas/tariffSchemas";

export async function getActiveTariffForTenantId(tenantId: string) {
  const tariff = await prisma.tariff.findFirst({ where: { tenantId, isActive: true } });
  if (!tariff) {
    throw new NotFoundError("Tarifa activa");
  }
  return tariff;
}

/** Publica: cualquiera puede consultar la tarifa activa de un tenant por su slug. */
export async function getActiveTariffForSlug(tenantSlug: string) {
  const tenant = await getActiveTenantBySlug(tenantSlug);
  return getActiveTariffForTenantId(tenant.id);
}

export async function listTariffsForTenant(tenantId: string) {
  return prisma.tariff.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
}

/**
 * Crea una nueva tarifa y la marca como activa PARA ESE TENANT, desactivando
 * cualquier otra tarifa del mismo tenant. Nunca toca tarifas de otro tenant.
 */
export async function createActiveTariff(tenantId: string, input: CreateTariffInput) {
  return prisma.$transaction(async (tx) => {
    await tx.tariff.updateMany({ where: { tenantId, isActive: true }, data: { isActive: false } });
    return tx.tariff.create({
      data: {
        tenantId,
        name: input.name,
        ratePerHourCents: input.ratePerHourCents,
        dailyMaxCents: input.dailyMaxCents,
        currency: input.currency,
        isActive: true,
      },
    });
  });
}

export async function deactivateTariff(tenantId: string, tariffId: string) {
  const tariff = await prisma.tariff.findUnique({ where: { id: tariffId } });
  if (!tariff) {
    throw new NotFoundError("Tarifa");
  }
  // Nunca confiar solo en el id: debe pertenecer al tenant de quien lo pide.
  if (tariff.tenantId !== tenantId) {
    throw new ForbiddenError();
  }
  if (!tariff.isActive) {
    throw new ConflictError("La tarifa ya esta inactiva");
  }
  return prisma.tariff.update({ where: { id: tariffId }, data: { isActive: false } });
}
