import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { createApiKeySchema } from "../schemas/apiKeySchemas";
import { createApiKey, listApiKeys, revokeApiKey } from "../services/apiKeyService";

export const apiKeysRouter = Router();

// TENANT_ADMIN gestiona las keys de su tenant; SUPER_ADMIN las suyas
// propias (sin tenant). TENANT_USER no puede crear ni ver API keys.
apiKeysRouter.use(requireAuth, requireRole("SUPER_ADMIN", "TENANT_ADMIN"));

apiKeysRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.status(200).json(await listApiKeys(req.auth!));
  })
);

apiKeysRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createApiKeySchema.parse(req.body);
    const apiKey = await createApiKey(req.auth!, input);
    res.status(201).json(apiKey);
  })
);

apiKeysRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await revokeApiKey(req.auth!, req.params.id);
    res.status(204).send();
  })
);
