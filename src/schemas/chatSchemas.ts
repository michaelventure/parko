import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1000),
});

export const chatRequestSchema = z.object({
  // El tenant ya no viene del body: lo fija el token de sesion verificado
  // en la ruta (ver src/routes/chat.ts) para que un cliente no pueda
  // pedir el chat de un tenant que no es el suyo.
  // Limite de mensajes: acota el costo/tamaño del payload y evita que un
  // cliente reenvie un historial que crece sin control.
  messages: z.array(chatMessageSchema).min(1).max(20),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
