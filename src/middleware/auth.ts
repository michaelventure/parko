import { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAuthToken } from "../lib/jwt";
import { verifyApiKey } from "../services/apiKeyService";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";
import { asyncHandler } from "./asyncHandler";

/**
 * Exige una sesion valida (header `Authorization: Bearer <credencial>`).
 * La credencial puede ser un token JWT (sesion humana, correo+contraseña)
 * o una API key (`pk_...`, para agentes/integraciones) — el formato decide
 * cual es cual. Deja el resultado en `req.auth` para los siguientes
 * middlewares; a ambos les da la misma forma { sub, role, tenantId }.
 */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Falta el header Authorization: Bearer <token>");
  }

  const credential = header.slice("Bearer ".length);

  if (credential.startsWith("pk_")) {
    req.auth = await verifyApiKey(credential);
  } else {
    try {
      req.auth = verifyAuthToken(credential);
    } catch {
      throw new UnauthorizedError("Token invalido o expirado");
    }
  }
  next();
});

/** Exige que el usuario autenticado tenga uno de los roles indicados. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}

/**
 * Exige que el usuario pertenezca a un tenant (excluye a SUPER_ADMIN, que
 * no tiene tenantId). Usar en rutas que operan datos de un tenant.
 */
export function requireTenantScope(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.tenantId) {
    throw new ForbiddenError("Esta accion requiere pertenecer a un tenant");
  }
  next();
}
