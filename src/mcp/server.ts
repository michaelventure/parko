import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthTokenPayload } from "../lib/jwt";
import { registerConsultaTools } from "./tools/consulta";
import { registerTransaccionalTools } from "./tools/transaccional";
import { registerAdminTenantTools } from "./tools/adminTenant";
import { registerAdminGeneralTools } from "./tools/adminGeneral";

/**
 * Construye un McpServer nuevo para UNA conexion, registrando solo las
 * tools que corresponden a la identidad resuelta de esa conexion (o solo
 * las publicas si `auth` es null). Nunca se reutiliza entre conexiones de
 * distintos llamadores — evita que las tools de un tenant se filtren a otro.
 */
export function buildMcpServer(auth: AuthTokenPayload | null): McpServer {
  const server = new McpServer({ name: "parko-mcp", version: "1.0.0" });

  registerConsultaTools(server);
  registerTransaccionalTools(server);

  if (auth?.role === "TENANT_ADMIN" && auth.tenantId) {
    registerAdminTenantTools(server, auth);
  } else if (auth?.role === "SUPER_ADMIN") {
    registerAdminGeneralTools(server);
  }
  // TENANT_USER no suma tools hoy: sus acciones ya son las publicas.

  return server;
}
