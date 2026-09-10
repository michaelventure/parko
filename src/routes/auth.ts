import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { strictLimiter } from "../middleware/rateLimit";
import { loginSchema } from "../schemas/authSchemas";
import { login } from "../services/authService";

export const authRouter = Router();

authRouter.post(
  "/login",
  strictLimiter, // evita fuerza bruta de contraseñas
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await login(input.email, input.password);
    res.status(200).json(result);
  })
);
