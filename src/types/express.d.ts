import type { AuthTokenPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      /** Presente solo despues de pasar por requireAuth. */
      auth?: AuthTokenPayload;
    }
  }
}

export {};
