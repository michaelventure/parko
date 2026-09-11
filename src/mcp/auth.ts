import type { Request } from "express";
import { verifyApiKey } from "../services/apiKeyService";
import { UnauthorizedError } from "../errors/AppError";
import type { AuthTokenPayload } from "../lib/jwt";

/**
 * Resuelve la identidad de una conexion MCP a partir del header
 * Authorization. Sin header -> acceso publico (null, tools de consulta y
 * transaccionales solamente). Con header invalido -> lanza (rechaza la
 * conexion). Solo acepta API keys aqui — las conexiones MCP son de
 * agentes/integraciones, nunca de una sesion humana con JWT.
 */
export async function resolveMcpAuth(req: Request): Promise<AuthTokenPayload | null> {
  const header = req.header("authorization");
  if (!header) {
    return null;
  }
  if (!header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Formato de Authorization invalido, usa: Bearer <api key>");
  }
  const credential = header.slice("Bearer ".length);
  return verifyApiKey(credential);
}
