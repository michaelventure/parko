import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole, requireTenantScope } from "../middleware/auth";
import { createCapacitySchema } from "../schemas/capacitySchemas";
import {
  createActiveCapacity,
  getAvailabilityForSlug,
  getCapacityStatus,
} from "../services/capacityService";

export const capacityRouter = Router();

const tenantSlugQuerySchema = z.object({ tenantSlug: z.string().min(1) });

// Publica: nunca expone un numero negativo, ni el conteo crudo de ocupados.
capacityRouter.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const { tenantSlug } = tenantSlugQuerySchema.parse(req.query);
    const availability = await getAvailabilityForSlug(tenantSlug);
    res.status(200).json(availability);
  })
);

// Administrativas: solo el TENANT_ADMIN de ese tenant.
capacityRouter.use(requireAuth, requireTenantScope, requireRole("TENANT_ADMIN"));

capacityRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    res.status(200).json(await getCapacityStatus(req.auth!.tenantId!));
  })
);

capacityRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createCapacitySchema.parse(req.body);
    const capacity = await createActiveCapacity(req.auth!.tenantId!, input);
    res.status(201).json(capacity);
  })
);
