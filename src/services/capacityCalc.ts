/**
 * Funciones puras de disponibilidad. "Ocupado" es una aproximacion por
 * tickets pagados y vigentes, no una medicion fisica del lote — por eso el
 * numero publico nunca puede ser negativo, aunque el conteo real de
 * ocupados supere el total configurado (sobrecupo).
 */

export function calculateAvailableSpaces(totalSpaces: number, occupiedSpaces: number): number {
  return Math.max(totalSpaces - occupiedSpaces, 0);
}

export function calculateOverflow(totalSpaces: number, occupiedSpaces: number): number {
  return Math.max(occupiedSpaces - totalSpaces, 0);
}
