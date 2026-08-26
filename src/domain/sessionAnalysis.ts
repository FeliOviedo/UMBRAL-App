/**
 * Análisis de una sesión ya completada: carga metabólica, distribución de
 * tiempo por zona, y comparación contra lo planificado.
 *
 * Todavía no es la Caja Negra (Fase 5) ni el motor de adaptación (Fase 4): acá
 * sólo viven los cálculos que hacen falta para mostrar el detalle de UNA
 * sesión. `cajaNegra` y `estadoSupercompensacion`, que miran el historial
 * completo, se agregan en sus fases correspondientes.
 */

import { ADAPTATION_CONFIG } from './config';
import type { PaceZone, PlannedDay, Split, ZoneId } from './types';
import { zonaPorPace } from './zones';

// ─────────────────────────────────────────────────────────────────────────────
// Carga metabólica
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga metabólica de una sesión: minutos de duración × intensidad percibida.
 *
 * Es deliberadamente la fórmula más simple que sirve de puente entre
 * disciplinas: no le importa si la sesión fue una corrida, una sesión de
 * fuerza o un partido de fútbol, sólo cuánto duró y qué tan dura se sintió. El
 * modelo de homeostasis y recuperación de la Fase 4 se apoya en este número,
 * no en las disciplinas específicas.
 */
export function calcularCargaMetabolica(durationSeconds: number, rpe: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.round((durationSeconds / 60) * rpe);
}

// ─────────────────────────────────────────────────────────────────────────────
// Distribución de tiempo por zona
// ─────────────────────────────────────────────────────────────────────────────

export interface TiempoPorZona {
  zona: ZoneId;
  segundos: number;
  /** Fracción 0-1 del tiempo total de los splits considerados. */
  fraccion: number;
}

/**
 * Reparte el tiempo de la sesión entre las 7 zonas, según el pace de cada
 * split.
 *
 * Es un análisis de APOYO: la sesión la clasifica el usuario con el RPE que
 * cargó, no esta distribución. Sirve para mostrar "corriste tanto tiempo en
 * cada zona", no para decidir la intensidad de la sesión.
 *
 * Devuelve sólo las zonas que tuvieron algo de tiempo, en el orden de `ZONES`
 * (de Z1 a Z5c), para que la UI no tenga que filtrar ceros.
 */
export function distribucionPorZona(
  splits: readonly Split[],
  paceZones: readonly PaceZone[],
): TiempoPorZona[] {
  const segundosPorZona = new Map<ZoneId, number>();
  let total = 0;

  for (const split of splits) {
    if (split.seconds <= 0) continue;
    const zona = zonaPorPace(split.paceSecPerKm, paceZones);
    segundosPorZona.set(zona.id, (segundosPorZona.get(zona.id) ?? 0) + split.seconds);
    total += split.seconds;
  }

  if (total === 0) return [];

  return paceZones
    .map((z) => z.id)
    .filter((id) => segundosPorZona.has(id))
    .map((zona) => {
      const segundos = segundosPorZona.get(zona)!;
      return { zona, segundos, fraccion: segundos / total };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparación plan vs. realidad
// ─────────────────────────────────────────────────────────────────────────────

export interface ComparacionPlanReal {
  kmPlanificados: number;
  kmReales: number;
  /** Diferencia real - planificado, en km. Positivo = corrió de más. */
  diferenciaKm: number;
  rpeObjetivo: number | null;
  rpeReal: number;
  /** Diferencia real - objetivo. Positivo = se sintió más duro de lo esperado. */
  diferenciaRpe: number | null;
  /**
   * true si el esfuerzo real se sintió sensiblemente más duro que el objetivo.
   * Es la señal cruda que el motor de adaptación (Fase 4) va a leer para
   * decidir si hay que meter una Recuperación antes del próximo Específico.
   */
  esfuerzoPorEncimaDeLoEsperado: boolean;
}

/** Compara una sesión real contra el día planificado que dice cumplir. */
export function compararPlanReal(
  planificado: Pick<PlannedDay, 'km' | 'targetRpe'>,
  real: { distanceMeters: number; rpe: number },
): ComparacionPlanReal {
  const kmPlanificados = planificado.km;
  const kmReales = real.distanceMeters / 1000;
  const rpeObjetivo = planificado.targetRpe ?? null;
  const diferenciaRpe = rpeObjetivo === null ? null : real.rpe - rpeObjetivo;

  return {
    kmPlanificados,
    kmReales,
    diferenciaKm: Math.round((kmReales - kmPlanificados) * 10) / 10,
    rpeObjetivo,
    rpeReal: real.rpe,
    diferenciaRpe,
    esfuerzoPorEncimaDeLoEsperado:
      diferenciaRpe !== null && diferenciaRpe >= ADAPTATION_CONFIG.rpeOvershootThreshold,
  };
}
