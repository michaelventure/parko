import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { chatLimiter, chatSessionLimiter } from "../middleware/rateLimit";
import { chatRequestSchema } from "../schemas/chatSchemas";
import { runChat } from "../chat/chatService";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { getActiveTenantBySlug } from "../services/tenantService";
import { signChatSessionToken, verifyChatSessionToken } from "../lib/chatSessionToken";
import { isSameOriginRequest } from "../lib/requestOrigin";
import { recordChatMessageAndCheckLimit } from "../services/chatUsageService";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../errors/AppError";

export const chatRouter = Router();

/**
 * El widget pide este token antes de poder chatear. Exigir que la request
 * venga del mismo origen que sirvio la pagina evita que alguien lo pida
 * desde afuera (curl/Postman) y lo reuse fuera del flujo del frontend. Es
 * POST (no GET) a proposito: los navegadores solo garantizan el header
 * Origin en metodos "unsafe" como POST — en un GET same-origin no lo
 * mandan, y ademas Referer viene deshabilitado globalmente por helmet
 * (Referrer-Policy: no-referrer en src/app.ts), asi que Origin es la unica
 * señal confiable disponible aqui.
 */
chatRouter.post(
  "/session",
  chatSessionLimiter,
  asyncHandler(async (req, res) => {
    if (!isSameOriginRequest(req)) {
      throw new ForbiddenError("Este endpoint solo puede llamarse desde el sitio de Parko");
    }

    const tenantSlug = String(req.body?.tenantSlug ?? "").trim();
    if (!tenantSlug) {
      throw new ValidationError("Falta tenantSlug");
    }

    const tenant = await getActiveTenantBySlug(tenantSlug);
    const { token, expiresIn } = signChatSessionToken({ tenantId: tenant.id, tenantSlug: tenant.slug });
    res.status(200).json({ token, expiresIn });
  })
);

chatRouter.post(
  "/",
  chatLimiter,
  asyncHandler(async (req, res) => {
    if (!env.DEEPSEEK_API_KEY) {
      res.status(503).json({
        error: { code: "CHAT_UNAVAILABLE", message: "El chat no está disponible en este momento." },
      });
      return;
    }

    const authHeader = req.header("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Falta el token de sesion de chat (POST /api/chat/session)");
    }

    let session;
    try {
      session = verifyChatSessionToken(authHeader.slice("Bearer ".length));
    } catch {
      throw new UnauthorizedError("Token de sesion de chat invalido o expirado");
    }

    const input = chatRequestSchema.parse(req.body);

    const { overLimit } = await recordChatMessageAndCheckLimit(session.tenantId);
    if (overLimit) {
      res.status(429).json({
        error: {
          code: "CHAT_DAILY_LIMIT_REACHED",
          message: "Este tenant alcanzo su limite de mensajes de chat por hoy. Intenta de nuevo mañana.",
        },
      });
      return;
    }

    try {
      const message = await runChat({ tenantId: session.tenantId, tenantSlug: session.tenantSlug, history: input.messages });
      res.status(200).json({ message });
    } catch (err) {
      logger.error({ err }, "Error llamando a DeepSeek");
      res.status(502).json({
        error: { code: "CHAT_UPSTREAM_ERROR", message: "No pude conectarme al asistente. Intenta de nuevo." },
      });
    }
  })
);
