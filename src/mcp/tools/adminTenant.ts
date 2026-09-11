import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withToolErrorHandling } from "../toolResult";
import type { AuthTokenPayload } from "../../lib/jwt";
import {
  createActiveTariff,
  deactivateTariff,
  listTariffsForTenant,
} from "../../services/tariffService";
import {
  createActiveCapacity,
  getCapacityStatus,
} from "../../services/capacityService";
import { createTenantUser, listUsersForTenant } from "../../services/userService";

/**
 * Las 7 tools de un TENANT_ADMIN, sobre SU propio tenant unicamente. El
 * tenantId siempre sale de `auth` (resuelto de la API key de la conexion),
 * nunca de un argumento de la tool — igual que en las rutas REST.
 */
export function registerAdminTenantTools(server: McpServer, auth: AuthTokenPayload) {
  const tenantId = auth.tenantId!;

  server.registerTool(
    "list_tariffs",
    {
      title: "Listar tarifas",
      description: "Historico completo de tarifas de mi tenant, activas e inactivas.",
    },
    withToolErrorHandling(async () => listTariffsForTenant(tenantId))
  );

  server.registerTool(
    "create_tariff",
    {
      title: "Crear tarifa",
      description: "Crea una tarifa y la vuelve la activa de mi tenant — afecta todo ticket nuevo.",
      inputSchema: {
        name: z.string().min(1).max(80),
        ratePerHourCents: z.number().int().positive(),
        dailyMaxCents: z.number().int().positive(),
        currency: z.string().length(3).optional(),
      },
    },
    withToolErrorHandling(
      async (input: { name: string; ratePerHourCents: number; dailyMaxCents: number; currency?: string }) =>
        createActiveTariff(tenantId, { ...input, currency: input.currency ?? "usd" })
    )
  );

  server.registerTool(
    "deactivate_tariff",
    {
      title: "Desactivar tarifa",
      description: "Desactiva una tarifa de mi tenant. Falla si el id pertenece a otro tenant.",
      inputSchema: { tariffId: z.string().uuid() },
    },
    withToolErrorHandling(async ({ tariffId }: { tariffId: string }) => deactivateTariff(tenantId, tariffId))
  );

  server.registerTool(
    "get_capacity_status",
    {
      title: "Estado de capacidad",
      description:
        "La verdad completa de mi tenant: ocupados puede superar el total. Incluye si hay sobrecupo ahora y el ultimo episodio registrado.",
    },
    withToolErrorHandling(async () => getCapacityStatus(tenantId))
  );

  server.registerTool(
    "create_capacity",
    {
      title: "Fijar capacidad",
      description: "Fija un nuevo total de espacios de mi tenant y lo vuelve el activo.",
      inputSchema: { totalSpaces: z.number().int().positive() },
    },
    withToolErrorHandling(async ({ totalSpaces }: { totalSpaces: number }) =>
      createActiveCapacity(tenantId, { totalSpaces })
    )
  );

  server.registerTool(
    "list_users",
    {
      title: "Listar usuarios",
      description: "Usuarios (admins y operadores) de mi propio tenant.",
    },
    withToolErrorHandling(async () => listUsersForTenant(tenantId))
  );

  server.registerTool(
    "create_user",
    {
      title: "Crear usuario",
      description: "Crea un usuario (TENANT_ADMIN o TENANT_USER) dentro de mi tenant — nunca un SUPER_ADMIN.",
      inputSchema: {
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(["TENANT_ADMIN", "TENANT_USER"]),
      },
    },
    withToolErrorHandling(
      async (input: { email: string; password: string; role: "TENANT_ADMIN" | "TENANT_USER" }) =>
        createTenantUser(tenantId, input)
    )
  );
}
