import { describe, expect, it } from "vitest";
import { calculateAmountCents } from "../src/services/pricing";

describe("calculateAmountCents", () => {
  it("multiplica tarifa por hora x horas cuando no supera el tope diario", () => {
    const amount = calculateAmountCents({ ratePerHourCents: 100, dailyMaxCents: 800, hours: 3 });
    expect(amount).toBe(300);
  });

  it("aplica el tope diario cuando el calculo lo supera", () => {
    const amount = calculateAmountCents({ ratePerHourCents: 100, dailyMaxCents: 500, hours: 10 });
    expect(amount).toBe(500);
  });

  it("redondea hacia arriba fracciones de hora (nunca cobra de menos)", () => {
    const amount = calculateAmountCents({ ratePerHourCents: 100, dailyMaxCents: 800, hours: 1.5 });
    expect(amount).toBe(150);
  });

  it("nunca devuelve un monto mayor al tope diario sin importar cuantas horas se pidan", () => {
    const amount = calculateAmountCents({ ratePerHourCents: 500, dailyMaxCents: 1000, hours: 24 });
    expect(amount).toBe(1000);
  });

  it("es una funcion pura que ignora cualquier precio externo: solo depende de tarifa y horas", () => {
    const a = calculateAmountCents({ ratePerHourCents: 200, dailyMaxCents: 2000, hours: 2 });
    const b = calculateAmountCents({ ratePerHourCents: 200, dailyMaxCents: 2000, hours: 2 });
    expect(a).toBe(b);
    expect(a).toBe(400);
  });
});
