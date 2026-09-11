import { env } from "./env";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: DeepseekToolCall[];
};

export type DeepseekToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolSpec = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type DeepseekResponse = {
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
};

/**
 * DeepSeek expone una API compatible con OpenAI (chat completions +
 * function calling). Un fetch simple evita sumar el SDK de OpenAI solo
 * para esto — es una sola llamada REST.
 */
export async function createChatCompletion(params: {
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  temperature?: number;
}): Promise<ChatMessage> {
  if (!env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY no configurado");
  }

  const response = await fetch(env.DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      messages: params.messages,
      tools: params.tools,
      max_tokens: params.maxTokens ?? 400,
      temperature: params.temperature ?? 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`DeepSeek respondio ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as DeepseekResponse;
  const choice = data.choices[0];
  if (!choice) {
    throw new Error("DeepSeek no devolvio ninguna respuesta");
  }
  return choice.message;
}
