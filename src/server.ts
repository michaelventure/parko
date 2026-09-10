import "dotenv/config";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { createApp } from "./app";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Parko API escuchando en http://localhost:${env.PORT} (docs en /docs)`);
});
