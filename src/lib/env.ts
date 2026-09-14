import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerido"),
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY es requerido"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET es requerido"),
  CHECKOUT_SUCCESS_URL: z.string().url(),
  CHECKOUT_CANCEL_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET debe tener al menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("12h"),
  // Opcional: sin esto, el envio de correo se omite (con warning) en vez de
  // tumbar el servidor — util mientras se configura una cuenta de Resend.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).default("Parko <onboarding@resend.dev>"),
  // Opcional: sin esto, el endpoint de chat responde 503 en vez de tumbar
  // el servidor.
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_API_URL: z.string().url().default("https://api.deepseek.com/chat/completions"),
  DEEPSEEK_MODEL: z.string().min(1).default("deepseek-chat"),
  // Tope de respaldo contra el costo de DeepSeek, independiente de que la
  // autenticacion del chat funcione o no (ver chatUsageService.ts).
  CHAT_DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(200),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno invalidas o faltantes:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
