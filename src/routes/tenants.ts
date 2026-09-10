import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { createTenantSchema } from "../schemas/tenantSchemas";
import { createTenantWithAdmin, listTenants, setTenantActive } from "../services/tenantService";

export const tenantsRouter = Router();

// Solo el Admin General gestiona tenants.
tenantsRouter.use(requireAuth, requireRole("SUPER_ADMIN"));

tenantsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.status(200).json(await listTenants());
  })
);

tenantsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createTenantSchema.parse(req.body);
    const result = await createTenantWithAdmin(input);
    res.status(201).json(result);
  })
);

tenantsRouter.post(
  "/:id/suspend",
  asyncHandler(async (req, res) => {
    res.status(200).json(await setTenantActive(req.params.id, false));
  })
);

tenantsRouter.post(
  "/:id/activate",
  asyncHandler(async (req, res) => {
    res.status(200).json(await setTenantActive(req.params.id, true));
  })
);
