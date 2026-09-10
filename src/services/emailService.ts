import { resend } from "../lib/resend";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import type { Ticket } from "@prisma/client";

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-DO", { style: "currency", currency: currency.toUpperCase() }).format(
      cents / 100
    );
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function formatHours(hours: number): string {
  if (hours === 24) return "Todo el día";
  if (hours < 1) return `${Math.round(hours * 60)} minutos`;
  if (hours === 1) return "1 hora";
  return `${hours} horas`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function buildEmailContent(ticket: Ticket) {
  const amount = formatMoney(ticket.amountCents, ticket.currency);
  const hours = formatHours(ticket.hoursRequested);
  const paidAt = ticket.paidAt ? formatDate(ticket.paidAt) : "—";

  const text = [
    "¡Pago confirmado!",
    "",
    `Ticket: ${ticket.id}`,
    `Tiempo pagado: ${hours}`,
    `Placa: ${ticket.plate ?? "No indicada"}`,
    `Monto pagado: ${amount}`,
    `Fecha de pago: ${paidAt}`,
    "",
    "Gracias por usar Parko.",
  ].join("\n");

  // Fondo e insignia de color forzados explicitamente: muchos clientes de
  // correo (Gmail, Apple Mail) aplican su propio modo oscuro a HTML sin
  // fondo declarado, y el texto oscuro queda ilegible sobre fondo oscuro.
  const html = `
    <div style="background-color: #ffffff; color-scheme: light; padding: 24px 16px;">
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #14181c; background-color: #ffffff;">
        <h1 style="font-size: 22px; margin-bottom: 4px; color: #14181c;">✅ Pago confirmado</h1>
        <p style="color: #4b5561; margin-top: 0;">Guarda este correo como tu comprobante.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 0; color: #4b5561;">Ticket</td><td style="padding: 6px 0; text-align: right; color: #14181c;">${ticket.id}</td></tr>
          <tr><td style="padding: 6px 0; color: #4b5561;">Tiempo pagado</td><td style="padding: 6px 0; text-align: right; color: #14181c;">${hours}</td></tr>
          <tr><td style="padding: 6px 0; color: #4b5561;">Placa</td><td style="padding: 6px 0; text-align: right; color: #14181c;">${ticket.plate ?? "No indicada"}</td></tr>
          <tr><td style="padding: 6px 0; color: #4b5561;">Monto pagado</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #14181c;">${amount}</td></tr>
          <tr><td style="padding: 6px 0; color: #4b5561;">Fecha de pago</td><td style="padding: 6px 0; text-align: right; color: #14181c;">${paidAt}</td></tr>
        </table>
        <p style="color: #4b5561; font-size: 14px;">Gracias por usar Parko.</p>
      </div>
    </div>
  `;

  return { text, html };
}

/**
 * Envia el correo de confirmacion de pago. Nunca lanza: un fallo de correo
 * no debe hacer que el webhook de Stripe reintente un pago que ya se
 * proceso correctamente. El resultado se registra siempre.
 */
export async function sendPaymentConfirmationEmail(ticket: Ticket, toEmail: string): Promise<boolean> {
  if (!resend) {
    logger.warn({ ticketId: ticket.id, toEmail }, "RESEND_API_KEY no configurado; se omite el correo de confirmacion");
    return false;
  }

  const { text, html } = buildEmailContent(ticket);

  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: toEmail,
      subject: "Pago confirmado — Parko",
      text,
      html,
    });

    if (result.error) {
      logger.error({ err: result.error, ticketId: ticket.id, toEmail }, "Resend devolvio un error al enviar el correo");
      return false;
    }

    logger.info({ ticketId: ticket.id, toEmail, resendId: result.data?.id }, "Correo de confirmacion enviado");
    return true;
  } catch (err) {
    logger.error({ err, ticketId: ticket.id, toEmail }, "Fallo el envio del correo de confirmacion");
    return false;
  }
}
