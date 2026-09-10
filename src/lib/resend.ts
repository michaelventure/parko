import { Resend } from "resend";
import { env } from "./env";

// El constructor de Resend lanza si la key esta vacia, asi que sin
// RESEND_API_KEY configurado dejamos el cliente en null — emailService.ts
// revisa esto antes de intentar enviar.
export const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
