import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole, requireTenantScope } from "../middleware/auth";
import { createTariffSchema } from "../schemas/tariffSchemas";
import {
  createActiveTariff,
  deactivateTariff,
  getActiveTariffForSlug,
  listTariffsForTenant,
} from "../services/tariffService";

export const tariffsRouter = Router();

const tenantSlugQuerySchema = z.object({ tenantSlug: z.string().min(1) });

// Publica: cualquiera puede consultar la tarifa activa de un tenant.
tariffsRouter.get(
  "/active",
  asyncHandler(async (req, res) => {
    const { tenantSlug } = tenantSlugQuerySchema.parse(req.query);
    const tariff = await getActiveTariffForSlug(tenantSlug);
    res.status(200).json(tariff);
  })
);

// Administrativas: solo el TENANT_ADMIN de ese tenant, siempre sobre SU propio tenantId.
tariffsRouter.use(requireAuth, requireTenantScope, requireRole("TENANT_ADMIN"));

tariffsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.status(200).json(await listTariffsForTenant(req.auth!.tenantId!));
  })
);

tariffsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createTariffSchema.parse(req.body);
    const tariff = await createActiveTariff(req.auth!.tenantId!, input);
    res.status(201).json(tariff);
  })
);

tariffsRouter.post(
  "/:id/deactivate",
  asyncHandler(async (req, res) => {
    const tariff = await deactivateTariff(req.auth!.tenantId!, req.params.id);
    res.status(200).json(tariff);
  })
);
