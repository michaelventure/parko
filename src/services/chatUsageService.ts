import { prisma } from "../lib/prisma";
import { env } from "../lib/env";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cuenta un mensaje de chat para el tenant, hoy (UTC), y avisa si con este
 * ya se supero el tope diario. El incremento es atomico (upsert de
 * Postgres) asi que dos requests concurrentes nunca pisan el conteo del
 * otro. Se llama ANTES de invocar a DeepSeek — el mensaje que supera el
 * tope se cuenta pero no llega a gastar la llamada al modelo.
 *
 * Es un respaldo contra el costo, no un mecanismo de auth: aplica pase lo
 * que pase con el token de sesion o el chequeo de Origin (ver chat.ts).
 */
export async function recordChatMessageAndCheckLimit(tenantId: string): Promise<{ overLimit: boolean; count: number }> {
  const usageDate = todayUtc();
  const usage = await prisma.chatUsage.upsert({
    where: { tenantId_usageDate: { tenantId, usageDate } },
    update: { messageCount: { increment: 1 } },
    create: { tenantId, usageDate, messageCount: 1 },
  });
  return { overLimit: usage.messageCount > env.CHAT_DAILY_MESSAGE_LIMIT, count: usage.messageCount };
}
