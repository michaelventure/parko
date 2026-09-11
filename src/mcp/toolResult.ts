import { AppError } from "../errors/AppError";
import { logger } from "../lib/logger";

/**
 * Convierte cualquier valor en el formato de resultado que espera el
 * protocolo MCP: contenido de texto (JSON legible) mas metadata.
 */
export function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Ejecuta el handler de una tool y traduce errores conocidos (AppError:
 * validacion, 404, 403, 409) al mismo texto que ya usa la API — nunca deja
 * pasar un stack trace. Un agente puede leer `isError` y reaccionar, en vez
 * de que la llamada explote como un error de protocolo JSON-RPC.
 */
// `any[]` a proposito: envolver esto con un generico variadico (Args
// extends unknown[]) hace que TypeScript intente unificarlo contra los
// overloads de registerTool del SDK de MCP y explota con "Type
// instantiation is excessively deep". El tipado real de cada tool ya
// queda fijado por la anotacion explicita del callback en cada archivo.
export function withToolErrorHandling<T>(fn: (...args: any[]) => Promise<T>) {
  return async (...args: any[]) => {
    try {
      const data = await fn(...args);
      return jsonResult(data);
    } catch (err) {
      if (err instanceof AppError) {
        return {
          content: [{ type: "text" as const, text: `${err.code}: ${err.message}` }],
          isError: true,
        };
      }
      logger.error({ err }, "Error no controlado en una tool de MCP");
      return {
        content: [{ type: "text" as const, text: "INTERNAL_ERROR: Ocurrio un error interno" }],
        isError: true,
      };
    }
  };
}
