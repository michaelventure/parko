import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withToolErrorHandling } from "../toolResult";
import { getActiveTariffForSlug } from "../../services/tariffService";
import { getTicketById } from "../../services/ticketService";
import { getAvailabilityForSlug } from "../../services/capacityService";
import { calculateAmountCents } from "../../services/pricing";

/** Las 4 tools de solo lectura, sin autenticacion. Siempre disponibles. */
export function registerConsultaTools(server: McpServer) {
  server.tool(
    "get_active_tariff",
    "Tarifa vigente de un tenant: precio por hora, tope diario y moneda.",
    {
      tenantSlug: z.string().min(1).describe("Identificador publico del tenant, ej. 'demo'"),
    },
    withToolErrorHandling(async ({ tenantSlug }: { tenantSlug: string }) => getActiveTariffForSlug(tenantSlug))
  );

  server.tool(
    "estimate_price",
    "Precio estimado para N horas en un tenant, sin crear ningun ticket. El monto final y definitivo siempre lo calcula el servidor al crear el ticket real.",
    {
      tenantSlug: z.string().min(1),
      hours: z.number().min(0.5).max(24).describe("Horas de estacionamiento (0.5 a 24)"),
    },
    withToolErrorHandling(async ({ tenantSlug, hours }: { tenantSlug: string; hours: number }) => {
      const tariff = await getActiveTariffForSlug(tenantSlug);
      const amountCents = calculateAmountCents({
        ratePerHourCents: tariff.ratePerHourCents,
        dailyMaxCents: tariff.dailyMaxCents,
        hours,
      });
      return { amountCents, currency: tariff.currency };
    })
  );

  server.tool(
    "get_ticket_status",
    "Estado real de un ticket de parqueo: pendiente, pagado, expirado o cancelado.",
    {
      ticketId: z.string().uuid(),
    },
    withToolErrorHandling(async ({ ticketId }: { ticketId: string }) => getTicketById(ticketId))
  );

  server.tool(
    "get_availability",
    "Espacios totales y disponibles ahora mismo en un tenant. availableSpaces nunca es negativo, aunque haya sobrecupo real.",
    {
      tenantSlug: z.string().min(1),
    },
    withToolErrorHandling(async ({ tenantSlug }: { tenantSlug: string }) => getAvailabilityForSlug(tenantSlug))
  );
}
