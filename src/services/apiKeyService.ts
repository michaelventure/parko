import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateApiKey, parseApiKey, secretMatchesHash } from "../lib/apiKey";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors/AppError";
import type { AuthTokenPayload } from "../lib/jwt";

export type CreateApiKeyInput = { name: string; role?: "TENANT_ADMIN" | "TENANT_USER" };

/**
 * Una API key siempre hereda el alcance de quien la crea: un TENANT_ADMIN
 * solo puede emitir keys de SU propio tenant, un SUPER_ADMIN solo emite
 * keys SUPER_ADMIN (sin tenant). Nunca se confia en un tenantId/role del
 * body para decidir el alcance de la key.
 */
export async function createApiKey(caller: AuthTokenPayload, input: CreateApiKeyInput) {
  let tenantId: string | null;
  let role: UserRole;

  if (caller.role === "SUPER_ADMIN") {
    tenantId = null;
    role = "SUPER_ADMIN";
  } else if (caller.role === "TENANT_ADMIN") {
    tenantId = caller.tenantId;
    role = input.role ?? "TENANT_ADMIN";
  } else {
    throw new ForbiddenError("Los usuarios operativos no pueden crear API keys");
  }

  const { fullKey, prefix, keyHash } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: { tenantId, name: input.name, prefix, keyHash, role },
  });

  // El valor completo solo se devuelve aqui, una unica vez.
  return {
    id: apiKey.id,
    name: apiKey.name,
    role: apiKey.role,
    tenantId: apiKey.tenantId,
    createdAt: apiKey.createdAt,
    key: fullKey,
  };
}

export async function listApiKeys(caller: AuthTokenPayload) {
  const where = caller.role === "SUPER_ADMIN" ? { tenantId: null } : { tenantId: caller.tenantId };
  const keys = await prisma.apiKey.findMany({
    where,
    select: {
      id: true,
      name: true,
      prefix: true,
      role: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return keys;
}

export async function revokeApiKey(caller: AuthTokenPayload, apiKeyId: string) {
  const apiKey = await prisma.apiKey.findUnique({ where: { id: apiKeyId } });
  if (!apiKey) {
    throw new NotFoundError("API key");
  }

  const ownsKey =
    caller.role === "SUPER_ADMIN" ? apiKey.tenantId === null : apiKey.tenantId === caller.tenantId;
  if (!ownsKey) {
    throw new ForbiddenError();
  }

  return prisma.apiKey.update({ where: { id: apiKeyId }, data: { revokedAt: new Date() } });
}

/** Usado por el middleware de auth para validar una API key presentada en un request. */
export async function verifyApiKey(fullKey: string): Promise<AuthTokenPayload> {
  const parsed = parseApiKey(fullKey);
  if (!parsed) {
    throw new UnauthorizedError("Formato de API key invalido");
  }

  const apiKey = await prisma.apiKey.findUnique({ where: { prefix: parsed.prefix } });
  if (!apiKey || apiKey.revokedAt) {
    throw new UnauthorizedError("API key invalida o revocada");
  }

  if (!secretMatchesHash(parsed.secret, apiKey.keyHash)) {
    throw new UnauthorizedError("API key invalida o revocada");
  }

  // Best-effort: no bloquea la respuesta si falla.
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { sub: apiKey.id, role: apiKey.role, tenantId: apiKey.tenantId };
}
