import { describe, expect, it } from 'vitest';
import {
  chartTokens,
  colorPorTipo,
  INTENSIDAD_CLARA,
  INTENSIDAD_OSCURA,
  intensidad,
  NIVEL_INTENSIDAD,
  regresionLineal,
} from '@/lib/chart';

describe('regresión lineal', () => {
  it('encuentra la recta exacta cuando los puntos son colineales', () => {
    const puntos = [
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
      { x: 4, y: 9 },
    ];
    const r = regresionLineal(puntos)!;
    expect(r.m).toBeCloseTo(2, 10);
    expect(r.b).toBeCloseTo(1, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });

  it('detecta pendiente negativa: mejora del RPE en el tiempo', () => {
    // Días atrás en x, RPE en y: cuanto más reciente (x chico), menos esfuerzo.
    const puntos = [
      { x: 30, y: 6 },
      { x: 20, y: 6 },
      { x: 10, y: 5 },
      { x: 2, y: 4 },
    ];
    const r = regresionLineal(puntos)!;
    expect(r.m).toBeGreaterThan(0); // más días atrás → más RPE
    expect(r.r2).toBeGreaterThan(0.8);
  });

  it('devuelve null con menos de tres puntos', () => {
    expect(regresionLineal([])).toBeNull();
    expect(regresionLineal([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
  });

  it('devuelve null si todos los x son iguales: no hay recta que ajustar', () => {
    const puntos = [
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ];
    expect(regresionLineal(puntos)).toBeNull();
  });

  it('da r² bajo cuando no hay relación', () => {
    const puntos = [
      { x: 1, y: 5 },
      { x: 2, y: 1 },
      { x: 3, y: 5 },
      { x: 4, y: 1 },
      { x: 5, y: 5 },
    ];
    expect(regresionLineal(puntos)!.r2).toBeLessThan(0.2);
  });

  it('no explota si todos los y son iguales', () => {
    const r = regresionLineal([
      { x: 1, y: 4 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ])!;
    expect(r.m).toBeCloseTo(0, 10);
    expect(Number.isFinite(r.r2)).toBe(true);
  });
});

describe.each([
  ['dark', INTENSIDAD_OSCURA] as const,
  ['light', INTENSIDAD_CLARA] as const,
])('rampa de intensidad (%s)', (tema, rampa) => {
  it('tiene un color por nivel de la escala', () => {
    expect(intensidad(tema)).toHaveLength(4);
    expect(intensidad(tema)).toEqual(rampa);
  });

  it('el descanso queda fuera de la rampa: no tiene carga que representar', () => {
    expect(NIVEL_INTENSIDAD.D).toBeLessThan(0);
    expect(colorPorTipo('D', tema)).not.toBe(rampa[0]);
  });

  it('a más intensidad, un paso más alto de la rampa', () => {
    expect(NIVEL_INTENSIDAD.R!).toBeLessThan(NIVEL_INTENSIDAD.F!);
    expect(NIVEL_INTENSIDAD.F!).toBeLessThan(NIVEL_INTENSIDAD.E!);
    expect(colorPorTipo('E', tema)).toBe(rampa[3]);
  });

  it('un día sin sesión usa la superficie del tema, no un color de la rampa', () => {
    const superficie = chartTokens(tema).superficie;
    expect(colorPorTipo(null, tema)).toBe(superficie);
    expect(colorPorTipo('desconocido', tema)).toBe(superficie);
  });
});

describe('chartTokens', () => {
  it('dark y light son juegos de colores distintos', () => {
    expect(chartTokens('dark')).not.toEqual(chartTokens('light'));
  });

  it('el acento claro es el lima apagado, no el brillante', () => {
    expect(chartTokens('light').acento).toBe('#A7D626');
    expect(chartTokens('dark').acento).toBe('#CDFF4F');
  });
});
