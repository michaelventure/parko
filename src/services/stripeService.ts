import Stripe from "stripe";
import { stripe } from "../lib/stripe";
import { env } from "../lib/env";
import { ConflictError } from "../errors/AppError";
import type { Ticket } from "@prisma/client";

export async function createCheckoutSessionForTicket(ticket: Ticket) {
  if (ticket.status !== "PENDING_PAYMENT") {
    throw new ConflictError(`El ticket esta en estado ${ticket.status} y no admite un nuevo cobro`);
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: ticket.currency,
          unit_amount: ticket.amountCents,
          product_data: {
            name: "Ticket de parqueo por hora",
            description: `${ticket.hoursRequested} hora(s)${ticket.plate ? ` - placa ${ticket.plate}` : ""}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: { ticketId: ticket.id },
    success_url: `${env.CHECKOUT_SUCCESS_URL}?ticketId=${ticket.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CHECKOUT_CANCEL_URL}?ticketId=${ticket.id}`,
  });
}

/**
 * Verifica la firma del webhook (prueba de que el evento realmente viene de
 * Stripe) usando el raw body de la peticion.
 */
export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Segunda verificacion, independiente del payload del webhook: se vuelve a
 * consultar la sesion directamente contra la API de Stripe y solo se confia
 * en `payment_status` de esa respuesta, nunca en datos que pudieran haber
 * sido manipulados en el evento recibido.
 */
export async function retrieveVerifiedSession(sessionId: string) {
  return stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
}
