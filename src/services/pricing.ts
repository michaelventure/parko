/**
 * Calcula el monto a cobrar (en centavos) para una sesion de parqueo.
 * Es una funcion pura: nunca recibe un precio del cliente, solo las horas
 * solicitadas y la tarifa activa leida desde la base de datos. El tope
 * diario limita el monto maximo independientemente de cuantas horas se
 * soliciten dentro de esa ventana de 24 horas.
 */
export function calculateAmountCents(params: {
  ratePerHourCents: number;
  dailyMaxCents: number;
  hours: number;
}): number {
  const { ratePerHourCents, dailyMaxCents, hours } = params;
  const rawAmount = Math.ceil(ratePerHourCents * hours);
  return Math.min(rawAmount, dailyMaxCents);
}

export const MIN_HOURS = 0.5;
export const MAX_HOURS = 24;
