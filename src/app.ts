import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { apiKeysRouter } from "./routes/apiKeys";
import { authRouter } from "./routes/auth";
import { capacityRouter } from "./routes/capacity";
import { tariffsRouter } from "./routes/tariffs";
import { tenantsRouter } from "./routes/tenants";
import { ticketsRouter } from "./routes/tickets";
import { usersRouter } from "./routes/users";
import { webhooksRouter } from "./routes/webhooks";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { standardLimiter } from "./middleware/rateLimit";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        // Helmet fusiona esto con sus directivas por defecto (useDefaults:
        // true); poner una en `null` es la forma correcta de quitarla del
        // resultado final. En desarrollo el servidor solo habla HTTP
        // (localhost sin TLS): la directiva upgrade-insecure-requests hace
        // que Safari reescriba /styles.css y /app.js a https:// y la
        // conexion TLS falla. En produccion (detras de HTTPS real) se deja
        // activa por seguridad.
        directives: env.NODE_ENV === "production" ? {} : { "upgrade-insecure-requests": null },
      },
    })
  );
  app.use(cors());
  app.use(pinoHttp({ logger }));

  // El webhook de Stripe necesita el body crudo (sin parsear) para poder
  // verificar la firma HMAC, por lo que se monta ANTES de express.json()
  // y solo para esta ruta especifica.
  app.use("/api/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const openapiPath = path.join(__dirname, "..", "docs", "openapi.yaml");
  const openapiDocument = YAML.load(openapiPath);
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

  // Red de seguridad general contra abuso/DoS accidental (ej. un agente en
  // bucle) — el webhook de Stripe queda fuera, ya se protege con firma HMAC.
  app.use("/api", standardLimiter);

  app.use("/api/auth", authRouter);
  app.use("/api/tenants", tenantsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/api-keys", apiKeysRouter);
  app.use("/api/tariffs", tariffsRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/capacity", capacityRouter);

  // Frontend estatico (formulario publico + paginas de resultado de pago).
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
