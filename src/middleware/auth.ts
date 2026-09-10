import { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifyAuthToken } from "../lib/jwt";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError";

/**
 * Exige una sesion valida (header `Authorization: Bearer <token>`).
 * Deja el payload del token en `req.auth` para los siguientes middlewares.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Falta el header Authorization: Bearer <token>");
  }

  const token = header.slice("Bearer ".length);
  try {
    req.auth = verifyAuthToken(token);
  } catch {
    throw new UnauthorizedError("Token invalido o expirado");
  }
  next();
}

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
