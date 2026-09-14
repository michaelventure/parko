import type { ToolSpec } from "../lib/deepseek";
import { getActiveTariffForSlug } from "../services/tariffService";
import { getAvailabilityForSlug } from "../services/capacityService";
import { getTicketById, createTicket, attachCheckoutSession } from "../services/ticketService";
import { createCheckoutSessionForTicket } from "../services/stripeService";
import { calculateAmountCents } from "../services/pricing";
import { AppError, NotFoundError } from "../errors/AppError";

/** Tenant real de la sesion de chat verificada (ver src/lib/chatSessionToken.ts) — nunca el que decida el modelo. */
export type ChatToolSession = { tenantId: string; tenantSlug: string };

/**
 * Las mismas 6 tools públicas que expone el servidor MCP (ver
 * src/mcp/tools/consulta.ts y transaccional.ts) — mismo contrato, mismos
 * services por debajo. El chat nunca tiene acceso a las tools de
 * administración: no existen en esta lista.
 *
 * Ninguna tool recibe tenantSlug como parametro del modelo: el tenant lo
 * fija siempre la sesion verificada (dispatchTool abajo), para que un
 * usuario no pueda, via inyeccion de prompt, hacer que el asistente lea o
 * accione datos de OTRO tenant.
 */
export const CHAT_TOOLS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_active_tariff",
      description: "Tarifa vigente del tenant: precio por hora, tope diario y moneda.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_price",
      description:
        "Precio estimado para N horas, sin crear ningun ticket. Usa esto SIEMPRE que el usuario pregunte cuanto le costaria algo, incluyendo cuando menciona una fecha/hora relativa — primero calcula cuantas horas hay entre ahora y ese momento.",
      parameters: {
        type: "object",
        properties: {
          hours: { type: "number", minimum: 0.5, maximum: 24, description: "Horas de estacionamiento" },
        },
        required: ["hours"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ticket_status",
      description: "Estado real de un ticket: pendiente, pagado, expirado o cancelado.",
      parameters: {
        type: "object",
        properties: { ticketId: { type: "string" } },
        required: ["ticketId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_availability",
      description: "Espacios totales y disponibles ahora mismo en el tenant.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_ticket",
      description:
        "Crea un ticket real de parqueo. SOLO llamar despues de que el usuario confirmo explicitamente las horas y el precio mostrado.",
      parameters: {
        type: "object",
        properties: {
          hours: { type: "number", minimum: 0.5, maximum: 24 },
          plate: { type: "string", description: "Placa del vehiculo (opcional)" },
        },
        required: ["hours"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_checkout_session",
      description: "Genera el link de pago de Stripe para un ticket ya creado. Comparte el link con el usuario.",
      parameters: {
        type: "object",
        properties: { ticketId: { type: "string" } },
        required: ["ticketId"],
      },
    },
  },
];

/** Ejecuta una tool por nombre, siempre acotada al tenant de la sesion. Nunca lanza: los errores de negocio vuelven como texto legible. */
export async function executeChatTool(name: string, args: Record<string, unknown>, session: ChatToolSession): Promise<string> {
  try {
    const result = await dispatchTool(name, args, session);
    return JSON.stringify(result);
  } catch (err) {
    if (err instanceof AppError) {
      return JSON.stringify({ error: err.code, message: err.message });
    }
    return JSON.stringify({ error: "INTERNAL_ERROR", message: "Ocurrio un error interno" });
  }
}

/**
 * Carga un ticket y confirma que pertenezca al tenant de la sesion. Se
 * responde 404 (no "no autorizado") para no confirmarle a quien pregunta
 * que el ticket existe en otro tenant.
 */
async function getOwnTicketOrThrow(ticketId: string, session: ChatToolSession) {
  const ticket = await getTicketById(ticketId);
  if (ticket.tenantId !== session.tenantId) {
    throw new NotFoundError("Ticket");
  }
  return ticket;
}

async function dispatchTool(name: string, args: Record<string, unknown>, session: ChatToolSession): Promise<unknown> {
  switch (name) {
    case "get_active_tariff":
      return getActiveTariffForSlug(session.tenantSlug);

    case "estimate_price": {
      const tariff = await getActiveTariffForSlug(session.tenantSlug);
      const hours = Number(args.hours);
      const amountCents = calculateAmountCents({
        ratePerHourCents: tariff.ratePerHourCents,
        dailyMaxCents: tariff.dailyMaxCents,
        hours,
      });
      return { amountCents, currency: tariff.currency };
    }

    case "get_ticket_status":
      return getOwnTicketOrThrow(String(args.ticketId), session);

    case "get_availability":
      return getAvailabilityForSlug(session.tenantSlug);

    case "create_ticket": {
      const hours = Number(args.hours);
      const plate = typeof args.plate === "string" ? args.plate : undefined;
      return createTicket(session.tenantSlug, { tenantSlug: session.tenantSlug, hours, plate });
    }

    case "create_checkout_session": {
      const ticket = await getOwnTicketOrThrow(String(args.ticketId), session);
      const checkoutSession = await createCheckoutSessionForTicket(ticket);
      await attachCheckoutSession(ticket.id, checkoutSession.id);
      return { checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id };
    }

    default:
      return { error: "UNKNOWN_TOOL", message: `Tool desconocida: ${name}` };
  }
}
