import type { Request } from "express";

/**
 * true si el Origin (o, en su defecto, el Referer) de la request apunta al
 * mismo host que sirvio la pagina. Se usa para que solo el widget cargado
 * desde este mismo despliegue pueda pedir un token de sesion de chat — un
 * script externo que llama directo a la API no trae ninguno de los dos
 * headers con el valor correcto.
 */
export function isSameOriginRequest(req: Request): boolean {
  const header = req.get("origin") || req.get("referer");
  if (!header) return false;

  try {
    return new URL(header).host === req.get("host");
  } catch {
    return false;
  }
}
