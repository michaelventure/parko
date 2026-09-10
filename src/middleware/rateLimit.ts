import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

function sendRateLimited(_req: Request, res: Response) {
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
  });
}

/**
 * Para acciones sensibles/costosas sin autenticacion: login (evita fuerza
 * bruta de contraseñas) y crear tickets/cobros (evita que un agente en
 * bucle sature la API o genere sesiones de Stripe sin control). Por IP —
 * simple y suficiente para el volumen actual; si mas adelante hay abuso
 * distribuido entre IPs, se puede afinar por API key.
 */
export const strictLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimited,
});

/** Red de seguridad general para el resto de la API. */
export const standardLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimited,
});
