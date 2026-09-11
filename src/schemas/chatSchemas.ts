import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1000),
});

export const chatRequestSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  // Limite de mensajes: acota el costo/tamaño del payload y evita que un
  // cliente reenvie un historial que crece sin control.
  messages: z.array(chatMessageSchema).min(1).max(20),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
