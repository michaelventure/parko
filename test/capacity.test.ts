import { describe, expect, it } from "vitest";
import { calculateAvailableSpaces, calculateOverflow } from "../src/services/capacityCalc";

describe("calculateAvailableSpaces", () => {
  it("resta ocupados del total cuando hay espacio libre", () => {
    expect(calculateAvailableSpaces(40, 25)).toBe(15);
  });

  it("nunca devuelve un numero negativo en sobrecupo", () => {
    expect(calculateAvailableSpaces(40, 47)).toBe(0);
  });

  it("devuelve el total completo cuando no hay ocupados", () => {
    expect(calculateAvailableSpaces(40, 0)).toBe(40);
  });
});

describe("calculateOverflow", () => {
  it("es 0 cuando los ocupados no superan el total", () => {
    expect(calculateOverflow(40, 40)).toBe(0);
    expect(calculateOverflow(40, 25)).toBe(0);
  });

  it("devuelve el excedente exacto en sobrecupo", () => {
    expect(calculateOverflow(40, 47)).toBe(7);
  });
});
