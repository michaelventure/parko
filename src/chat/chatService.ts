import { createChatCompletion, type ChatMessage } from "../lib/deepseek";
import { buildSystemPrompt } from "./systemPrompt";
import { CHAT_TOOLS, executeChatTool } from "./tools";
import { logger } from "../lib/logger";

const MAX_TOOL_LOOPS = 4;

export type PublicChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Corre el ciclo completo: manda el historial + tools a DeepSeek, y si
 * responde con tool_calls, las ejecuta y vuelve a preguntar — hasta que
 * llegue una respuesta de texto o se agote MAX_TOOL_LOOPS (nunca deja que
 * un bucle de tool-calling se quede sin fin).
 */
export async function runChat(params: { tenantSlug: string; history: PublicChatMessage[] }): Promise<string> {
  const { tenantSlug, history } = params;

  const systemPrompt = buildSystemPrompt({ tenantSlug, nowIso: new Date().toISOString() });
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content }) satisfies ChatMessage),
  ];

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    const reply = await createChatCompletion({ messages, tools: CHAT_TOOLS });

    if (!reply.tool_calls || reply.tool_calls.length === 0) {
      return reply.content ?? "Disculpa, no pude generar una respuesta. ¿Puedes reformular tu pregunta?";
    }

    // El mensaje del asistente con tool_calls debe quedar en el historial
    // antes de las respuestas de cada tool, tal como exige el protocolo.
    messages.push(reply);

    for (const call of reply.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // argumentos malformados del modelo; se le informa como error de tool.
      }

      logger.info({ tool: call.function.name, args }, "Chat: ejecutando tool");
      const result = await executeChatTool(call.function.name, args);

      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  logger.warn({ tenantSlug }, "Chat: se agotaron los intentos de tool-calling");
  return "Estoy teniendo dificultades para completar tu solicitud en este momento. ¿Puedes intentar de nuevo en un momento, o darme más detalles?";
}
