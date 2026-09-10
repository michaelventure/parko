import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole, requireTenantScope } from "../middleware/auth";
import { createTenantUserSchema } from "../schemas/userSchemas";
import { createTenantUser, listUsersForTenant } from "../services/userService";

export const usersRouter = Router();

// Un TENANT_ADMIN gestiona solo los usuarios de SU propio tenant. El
// tenantId siempre sale de la sesion (req.auth), nunca del request.
usersRouter.use(requireAuth, requireTenantScope, requireRole("TENANT_ADMIN"));

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await listUsersForTenant(req.auth!.tenantId!);
    res.status(200).json(users);
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createTenantUserSchema.parse(req.body);
    const user = await createTenantUser(req.auth!.tenantId!, input);
    res.status(201).json(user);
  })
);
