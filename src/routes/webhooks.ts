import { Router } from "express";
import Stripe from "stripe";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError } from "../errors/AppError";
import { constructWebhookEvent, retrieveVerifiedSession } from "../services/stripeService";
import {
  markReceiptEmailSent,
  markTicketExpiredByCheckoutSession,
  markTicketPaidByCheckoutSession,
} from "../services/ticketService";
import { checkAndRecordOverflow } from "../services/capacityService";
import { sendPaymentConfirmationEmail } from "../services/emailService";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/stripe",
  asyncHandler(async (req, res) => {
    const signature = req.header("stripe-signature");
    if (!signature) {
      throw new ValidationError("Falta el header stripe-signature");
    }

    // req.body es un Buffer crudo (ver middleware express.raw en app.ts):
    // Stripe exige el payload sin parsear para poder validar la firma HMAC.
    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(req.body as Buffer, signature);
    } catch (err) {
      logger.warn({ err }, "Firma de webhook de Stripe invalida");
      throw new ValidationError("Firma de webhook invalida");
    }

    // Idempotencia: Stripe puede reenviar el mismo evento mas de una vez.
    // Esta fila es, ademas, el registro permanente de "cada evento de
    // webhook recibido" (id + tipo + cuando).
    const alreadyProcessed = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } });
    if (alreadyProcessed) {
      logger.info({ eventId: event.id, type: event.type }, "Evento de webhook duplicado, ignorado");
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
    await prisma.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
    logger.info({ eventId: event.id, type: event.type }, "Evento de webhook de Stripe recibido");

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const sessionFromEvent = event.data.object as Stripe.Checkout.Session;

      // No confiamos en el estado del payload del evento: se vuelve a
      // consultar la sesion directamente a la API de Stripe y solo se marca
      // el ticket como pagado si Stripe confirma payment_status === 'paid'.
      const verifiedSession = await retrieveVerifiedSession(sessionFromEvent.id);

      if (verifiedSession.payment_status === "paid") {
        const paymentIntentId =
          typeof verifiedSession.payment_intent === "string"
            ? verifiedSession.payment_intent
            : verifiedSession.payment_intent?.id ?? null;

        // Stripe Checkout ya le pide el correo al pagador en su propia
        // pagina; lo tomamos de ahi en vez de pedirlo en el formulario publico.
        const payerEmail = verifiedSession.customer_details?.email ?? null;

        const paidTicket = await markTicketPaidByCheckoutSession({
          checkoutSessionId: verifiedSession.id,
          paymentIntentId,
          payerEmail,
        });

        if (paidTicket) {
          // El unico momento en que "ocupados" puede subir es cuando un pago
          // se confirma; aqui es donde se detecta y registra el sobrecupo,
          // para el tenant especifico de ese ticket.
          await checkAndRecordOverflow(paidTicket.tenantId);

          if (payerEmail) {
            const sent = await sendPaymentConfirmationEmail(paidTicket, payerEmail);
            if (sent) {
              await markReceiptEmailSent(paidTicket.id);
            }
          } else {
            logger.warn({ ticketId: paidTicket.id }, "Pago confirmado sin correo del pagador; no se envio recibo");
          }
        }
      } else {
        logger.warn(
          { sessionId: verifiedSession.id, paymentStatus: verifiedSession.payment_status },
          "Sesion de checkout no esta pagada al momento de verificar"
        );
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      await markTicketExpiredByCheckoutSession(session.id);
    }

    res.status(200).json({ received: true });
  })
);
