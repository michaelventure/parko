import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { chatLimiter } from "../middleware/rateLimit";
import { chatRequestSchema } from "../schemas/chatSchemas";
import { runChat } from "../chat/chatService";
import { env } from "../lib/env";
import { logger } from "../lib/logger";

export const chatRouter = Router();

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

    const input = chatRequestSchema.parse(req.body);

    try {
      const message = await runChat({ tenantSlug: input.tenantSlug, history: input.messages });
      res.status(200).json({ message });
    } catch (err) {
      logger.error({ err }, "Error llamando a DeepSeek");
      res.status(502).json({
        error: { code: "CHAT_UPSTREAM_ERROR", message: "No pude conectarme al asistente. Intenta de nuevo." },
      });
    }
  })
);
