import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "../mcp/server";
import { resolveMcpAuth } from "../mcp/auth";
import { standardLimiter } from "../middleware/rateLimit";
import { UnauthorizedError } from "../errors/AppError";
import { logger } from "../lib/logger";

export const mcpRouter = Router();

mcpRouter.use(standardLimiter);

/**
 * Endpoint MCP remoto, sin estado (stateless): cada request POST crea un
 * McpServer y un transport nuevos, resuelve la identidad del llamador por
 * su API key, y los descarta al terminar. No hay sesion que mantener entre
 * requests, lo que evita mezclar el contexto de dos tenants distintos.
 */
mcpRouter.post("/", async (req, res) => {
  try {
    const auth = await resolveMcpAuth(req);
    const server = buildMcpServer(auth);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    await server.connect(transport);
    // `req.auth` en nuestro Request es AuthTokenPayload (ver
    // src/types/express.d.ts); el SDK espera su propio AuthInfo (OAuth) en
    // ese mismo campo opcional. Nunca lo asignamos aqui — el cast solo
    // evita el choque de tipos entre ambas declaraciones.
    await transport.handleRequest(req as unknown as Parameters<typeof transport.handleRequest>[0], res, req.body);

    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: err.message }, id: null });
      return;
    }
    logger.error({ err }, "Error manejando una conexion MCP");
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  }
});

// Modo stateless: no hay sesion que reanudar (GET) ni cerrar (DELETE).
mcpRouter.get("/", (_req, res) => {
  res
    .status(405)
    .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (servidor MCP sin estado)" }, id: null });
});

mcpRouter.delete("/", (_req, res) => {
  res
    .status(405)
    .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (servidor MCP sin estado)" }, id: null });
});
