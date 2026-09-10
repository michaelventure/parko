import { prisma } from "../lib/prisma";
import { ConflictError, NotFoundError } from "../errors/AppError";
import { calculateAmountCents } from "./pricing";
import { getActiveTariffForTenantId } from "./tariffService";
import { getActiveTenantBySlug } from "./tenantService";
import type { CreateTicketInput } from "../schemas/ticketSchemas";

/**
 * Publica: crea un ticket para el tenant identificado por su slug. La
 * tarifa se lee siempre del servidor para ESE tenant; el cliente nunca
 * envia un precio ni puede afectar la tarifa de otro tenant.
 */
export async function createTicket(tenantSlug: string, input: CreateTicketInput) {
  const tenant = await getActiveTenantBySlug(tenantSlug);
  const tariff = await getActiveTariffForTenantId(tenant.id);

  const amountCents = calculateAmountCents({
    ratePerHourCents: tariff.ratePerHourCents,
    dailyMaxCents: tariff.dailyMaxCents,
    hours: input.hours,
  });

  return prisma.ticket.create({
    data: {
      tenantId: tenant.id,
      plate: input.plate,
      hoursRequested: input.hours,
      tariffId: tariff.id,
      ratePerHourCentsUsed: tariff.ratePerHourCents,
      dailyMaxCentsUsed: tariff.dailyMaxCents,
      amountCents,
      currency: tariff.currency,
    },
  });
}

export async function getTicketById(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    throw new NotFoundError("Ticket");
  }
  return ticket;
}

export async function attachCheckoutSession(ticketId: string, sessionId: string) {
  const ticket = await getTicketById(ticketId);
  if (ticket.status !== "PENDING_PAYMENT") {
    throw new ConflictError(`El ticket esta en estado ${ticket.status} y no admite un nuevo cobro`);
  }
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { stripeCheckoutSessionId: sessionId },
  });
}

/**
 * Marca un ticket como pagado. Es idempotente: si ya estaba pagado (por un
 * reintento de webhook de Stripe) no vuelve a escribir ni lanza error.
 * Solo debe invocarse despues de verificar la sesion de Stripe. Devuelve el
 * ticket (con su tenantId) para que el caller pueda, por ejemplo, revisar
 * sobrecupo de capacidad del tenant correspondiente.
 */
export async function markTicketPaidByCheckoutSession(params: {
  checkoutSessionId: string;
  paymentIntentId: string | null;
  payerEmail: string | null;
}) {
  const ticket = await prisma.ticket.findUnique({
    where: { stripeCheckoutSessionId: params.checkoutSessionId },
  });

  if (!ticket) {
    return null;
  }

  if (ticket.status === "PAID") {
    return ticket;
  }

  if (ticket.status !== "PENDING_PAYMENT") {
    throw new ConflictError(`No se puede marcar como pagado un ticket en estado ${ticket.status}`);
  }

  return prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      stripePaymentIntentId: params.paymentIntentId ?? undefined,
      payerEmail: params.payerEmail ?? undefined,
    },
  });
}

export async function markReceiptEmailSent(ticketId: string) {
  return prisma.ticket.update({ where: { id: ticketId }, data: { receiptEmailSentAt: new Date() } });
}

export async function markTicketExpiredByCheckoutSession(checkoutSessionId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { stripeCheckoutSessionId: checkoutSessionId } });
  if (!ticket || ticket.status !== "PENDING_PAYMENT") {
    return ticket;
  }
  return prisma.ticket.update({ where: { id: ticket.id }, data: { status: "EXPIRED" } });
}
