import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "./env";

export type AuthTokenPayload = {
  sub: string;
  role: UserRole;
  tenantId: string | null;
};

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}
