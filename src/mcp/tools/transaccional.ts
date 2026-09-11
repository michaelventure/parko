import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withToolErrorHandling } from "../toolResult";
import { createTicket, getTicketById, attachCheckoutSession } from "../../services/ticketService";
import { createCheckoutSessionForTicket } from "../../services/stripeService";
import { MAX_HOURS, MIN_HOURS } from "../../services/pricing";

/**
 * Las 2 tools que crean efectos reales, sin autenticacion (igual que el
 * formulario publico). Un host MCP deberia pedir confirmacion humana antes
 * de ejecutarlas, dado que crean un ticket real o generan un cobro real.
 */
export function registerTransaccionalTools(server: McpServer) {
  server.registerTool(
    "create_ticket",
    {
      title: "Crear ticket de parqueo",
      description:
        "Crea un ticket real para un tenant. El precio lo calcula siempre el servidor a partir de la tarifa activa — nunca se acepta un monto del llamador.",
      inputSchema: {
        tenantSlug: z.string().min(1),
        hours: z.number().min(MIN_HOURS).max(MAX_HOURS),
        plate: z.string().min(3).max(15).optional().describe("Placa del vehiculo (opcional)"),
      },
    },
    withToolErrorHandling(
      async ({ tenantSlug, hours, plate }: { tenantSlug: string; hours: number; plate?: string }) =>
        createTicket(tenantSlug, { tenantSlug, hours, plate })
    )
  );

  server.registerTool(
    "create_checkout_session",
    {
      title: "Generar link de pago",
      description: "Crea una sesion de pago de Stripe Checkout para un ticket ya creado (PENDING_PAYMENT).",
      inputSchema: {
        ticketId: z.string().uuid(),
      },
    },
    withToolErrorHandling(async ({ ticketId }: { ticketId: string }) => {
      const ticket = await getTicketById(ticketId);
      const session = await createCheckoutSessionForTicket(ticket);
      await attachCheckoutSession(ticket.id, session.id);
      return { checkoutUrl: session.url, sessionId: session.id };
    })
  );
}
