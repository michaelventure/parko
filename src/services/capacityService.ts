import { prisma } from "../lib/prisma";
import { NotFoundError } from "../errors/AppError";
import { calculateAvailableSpaces, calculateOverflow } from "./capacityCalc";
import { getActiveTenantBySlug } from "./tenantService";

export async function getActiveCapacityForTenant(tenantId: string) {
  const capacity = await prisma.capacity.findFirst({ where: { tenantId, isActive: true } });
  if (!capacity) {
    throw new NotFoundError("Capacidad activa");
  }
  return capacity;
}

/**
 * Cuenta tickets PAID de un tenant cuya ventana de tiempo (entryTime +
 * hoursRequested) sigue vigente ahora mismo. Se hace en SQL porque
 * hoursRequested es un intervalo por fila, no algo que Prisma pueda
 * comparar en un `where` plano.
 */
export async function countOccupiedSpaces(tenantId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Ticket"
    WHERE "tenantId" = ${tenantId}
      AND status = 'PAID'
      AND "entryTime" <= NOW()
      AND "entryTime" + ("hoursRequested" * INTERVAL '1 hour') >= NOW()
  `;
  return Number(rows[0]?.count ?? 0);
}

/** Publica: nunca expone un numero negativo ni el conteo crudo de ocupados. */
export async function getAvailabilityForSlug(tenantSlug: string) {
  const tenant = await getActiveTenantBySlug(tenantSlug);
  const capacity = await getActiveCapacityForTenant(tenant.id);
  const occupiedSpaces = await countOccupiedSpaces(tenant.id);
  return {
    totalSpaces: capacity.totalSpaces,
    availableSpaces: calculateAvailableSpaces(capacity.totalSpaces, occupiedSpaces),
  };
}

/** Administrativa: la verdad completa para el TENANT_ADMIN, incluyendo sobrecupo. */
export async function getCapacityStatus(tenantId: string) {
  const capacity = await getActiveCapacityForTenant(tenantId);
  const occupiedSpaces = await countOccupiedSpaces(tenantId);
  return {
    totalSpaces: capacity.totalSpaces,
    occupiedSpaces,
    isOverflowingNow: occupiedSpaces > capacity.totalSpaces,
    lastOverflowAt: capacity.lastOverflowAt,
    lastOverflowAmount: capacity.lastOverflowAmount,
  };
}

export async function createActiveCapacity(tenantId: string, input: { totalSpaces: number }) {
  return prisma.$transaction(async (tx) => {
    await tx.capacity.updateMany({ where: { tenantId, isActive: true }, data: { isActive: false } });
    return tx.capacity.create({ data: { tenantId, totalSpaces: input.totalSpaces, isActive: true } });
  });
}

/**
 * Se invoca justo despues de confirmar el pago de un ticket de un tenant (el
 * unico momento en que su conteo de ocupados puede subir). Si el tenant no
 * tiene capacidad configurada todavia, no hace nada: es una funcionalidad
 * aditiva, no un requisito para vender tickets.
 */
export async function checkAndRecordOverflow(tenantId: string): Promise<void> {
  const capacity = await prisma.capacity.findFirst({ where: { tenantId, isActive: true } });
  if (!capacity) {
    return;
  }

  const occupiedSpaces = await countOccupiedSpaces(tenantId);
  const overflow = calculateOverflow(capacity.totalSpaces, occupiedSpaces);
  if (overflow > 0) {
    await prisma.capacity.update({
      where: { id: capacity.id },
      data: { lastOverflowAt: new Date(), lastOverflowAmount: overflow },
    });
  }
}
