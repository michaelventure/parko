import jwt from "jsonwebtoken";
import { env } from "./env";

const SUBJECT = "chat_session";
const EXPIRES_IN_SECONDS = 5 * 60;

export type ChatSessionPayload = {
  tenantId: string;
  tenantSlug: string;
};

/**
 * Token de corta duracion que el widget pide en GET /api/chat/session
 * antes de poder mandar mensajes a POST /api/chat. Sin esto, cualquiera
 * podia llamar a POST /chat directo (curl/Postman) con un tenantSlug
 * arbitrario y quemar la cuota de DEEPSEEK_API_KEY sin pasar por el
 * frontend. El `subject` fija el proposito del token: un JWT de sesion de
 * usuario (src/lib/jwt.ts) no sirve aqui aunque comparta el mismo secreto.
 */
export function signChatSessionToken(payload: ChatSessionPayload): { token: string; expiresIn: number } {
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: EXPIRES_IN_SECONDS, subject: SUBJECT });
  return { token, expiresIn: EXPIRES_IN_SECONDS };
}

export function verifyChatSessionToken(token: string): ChatSessionPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { subject: SUBJECT }) as jwt.JwtPayload;
  return { tenantId: decoded.tenantId as string, tenantSlug: decoded.tenantSlug as string };
}
