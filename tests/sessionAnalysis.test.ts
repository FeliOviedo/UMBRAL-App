import { describe, expect, it } from 'vitest';
import { generarZonasPace } from '@/domain/zones';
import {
  calcularCargaMetabolica,
  compararPlanReal,
  distribucionPorZona,
} from '@/domain/sessionAnalysis';
import type { Split } from '@/domain/types';

describe('carga metabólica', () => {
  it('multiplica minutos por RPE', () => {
    expect(calcularCargaMetabolica(1800, 6)).toBe(180); // 30 min · RPE 6
  });

  it('es 0 sin duración', () => {
    expect(calcularCargaMetabolica(0, 8)).toBe(0);
    expect(calcularCargaMetabolica(-10, 8)).toBe(0);
  });

  it('sirve igual para cualquier disciplina: sólo mira duración y RPE', () => {
    // Una sesión de fuerza de 45 min a RPE 7 aporta la misma carga que una
    // corrida de 45 min a RPE 7 — es el puente entre disciplinas.
    expect(calcularCargaMetabolica(2700, 7)).toBe(315);
  });
});

describe('distribución de tiempo por zona', () => {
  const zonasPace = generarZonasPace(300); // umbral 5:00/km

  const split = (paceSecPerKm: number, seconds: number): Split => ({
    km: 1,
    seconds,
    paceSecPerKm,
    meters: 1000,
  });

  it('reparte el tiempo total entre las zonas que se pisaron', () => {
    const splits = [split(450, 300), split(450, 300), split(310, 200)]; // Z1, Z1, Z4
    const result = distribucionPorZona(splits, zonasPace);

    expect(result).toEqual([
      { zona: 'Z1', segundos: 600, fraccion: 600 / 800 },
      { zona: 'Z4', segundos: 200, fraccion: 200 / 800 },
    ]);
  });

  it('devuelve las zonas en orden de Z1 a Z5c, no en el orden de los splits', () => {
    const splits = [split(200, 100), split(450, 100)]; // Z5c primero, después Z1
    const result = distribucionPorZona(splits, zonasPace);
    expect(result.map((r) => r.zona)).toEqual(['Z1', 'Z5c']);
  });

  it('ignora splits sin duración', () => {
    const splits = [split(300, 0), split(450, 200)];
    expect(distribucionPorZona(splits, zonasPace)).toHaveLength(1);
  });

  it('da vacío sin splits', () => {
    expect(distribucionPorZona([], zonasPace)).toEqual([]);
  });

  it('las fracciones de una sesión completa suman 1', () => {
    const splits = [split(450, 300), split(310, 200), split(270, 150)];
    const result = distribucionPorZona(splits, zonasPace);
    const suma = result.reduce((acc, r) => acc + r.fraccion, 0);
    expect(suma).toBeCloseTo(1, 10);
  });
});

describe('comparación plan vs. realidad', () => {
  it('calcula la diferencia de km y de RPE', () => {
    const result = compararPlanReal(
      { km: 10, targetRpe: 4 },
      { distanceMeters: 10_800, rpe: 5 },
    );
    expect(result.kmPlanificados).toBe(10);
    expect(result.kmReales).toBe(10.8);
    expect(result.diferenciaKm).toBe(0.8);
    expect(result.diferenciaRpe).toBe(1);
  });

  it('marca esfuerzo por encima de lo esperado cuando la diferencia de RPE es grande', () => {
    const result = compararPlanReal({ km: 10, targetRpe: 4 }, { distanceMeters: 10_000, rpe: 7 });
    expect(result.diferenciaRpe).toBe(3);
    expect(result.esfuerzoPorEncimaDeLoEsperado).toBe(true);
  });

  it('no marca nada si la diferencia es chica', () => {
    const result = compararPlanReal({ km: 10, targetRpe: 4 }, { distanceMeters: 10_000, rpe: 5 });
    expect(result.esfuerzoPorEncimaDeLoEsperado).toBe(false);
  });

  it('no falla si el día planificado no tenía RPE objetivo (por ejemplo, un Descanso)', () => {
    const result = compararPlanReal({ km: 0 }, { distanceMeters: 5000, rpe: 3 });
    expect(result.rpeObjetivo).toBeNull();
    expect(result.diferenciaRpe).toBeNull();
    expect(result.esfuerzoPorEncimaDeLoEsperado).toBe(false);
  });
});
