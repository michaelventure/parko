import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import { logger } from "../lib/logger";

type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function notFoundHandler(req: Request, res: Response) {
  const body: ErrorEnvelope = {
    error: { code: "NOT_FOUND", message: `Ruta no encontrada: ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: ErrorEnvelope = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ErrorEnvelope = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Los datos enviados no son validos",
        details: err.flatten(),
      },
    };
    res.status(400).json(body);
    return;
  }

  logger.error({ err }, "Error no controlado");
  const body: ErrorEnvelope = {
    error: { code: "INTERNAL_ERROR", message: "Ocurrio un error interno" },
  };
  res.status(500).json(body);
}
