import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withToolErrorHandling } from "../toolResult";
import { createTenantWithAdmin, listTenants, setTenantActive } from "../../services/tenantService";

/** Las 4 tools del SUPER_ADMIN: gestion de tenants, nada de tarifas/tickets. */
export function registerAdminGeneralTools(server: McpServer) {
  server.registerTool(
    "list_tenants",
    {
      title: "Listar tenants",
      description: "Todos los tenants de la plataforma, activos y suspendidos.",
    },
    withToolErrorHandling(async () => listTenants())
  );

  server.registerTool(
    "create_tenant",
    {
      title: "Crear tenant",
      description: "Crea un tenant nuevo y su primer TENANT_ADMIN, en una sola operacion.",
      inputSchema: {
        name: z.string().min(1).max(120),
        slug: z
          .string()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9-]+$/, "solo minusculas, numeros y guiones"),
        adminEmail: z.string().email(),
        adminPassword: z.string().min(8),
      },
    },
    withToolErrorHandling(
      async (input: { name: string; slug: string; adminEmail: string; adminPassword: string }) =>
        createTenantWithAdmin(input)
    )
  );

  server.registerTool(
    "suspend_tenant",
    {
      title: "Suspender tenant",
      description: "Desactiva un tenant — sus endpoints publicos empiezan a devolver 404.",
      inputSchema: { tenantId: z.string().uuid() },
    },
    withToolErrorHandling(async ({ tenantId }: { tenantId: string }) => setTenantActive(tenantId, false))
  );

  server.registerTool(
    "activate_tenant",
    {
      title: "Reactivar tenant",
      description: "Reactiva un tenant previamente suspendido.",
      inputSchema: { tenantId: z.string().uuid() },
    },
    withToolErrorHandling(async ({ tenantId }: { tenantId: string }) => setTenantActive(tenantId, true))
  );
}
