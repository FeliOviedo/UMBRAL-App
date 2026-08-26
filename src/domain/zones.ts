/**
 * Cálculo de umbral y derivación de las 7 zonas de Friel.
 *
 * El usuario carga UN dato (LTHR, o el resultado de un test) y de ahí sale todo
 * lo demás. Nada de "220 - edad".
 */

import { PACE_ZONE_FACTORS, THRESHOLD_TEST, ZONES } from './config';
import type { HeartRateZone, PaceZone, ZoneDefinition, ZoneId } from './types';

/** Variante del test de FC que hizo el usuario. */
export type LthrTestVariant = '30min' | '20min';

/**
 * Calcula la LTHR a partir de un test de campo.
 *
 * - `30min`: correr 30 min al máximo sostenible y promediar la FC de los
 *   ÚLTIMOS 20 min. Ese promedio es la LTHR tal cual.
 * - `20min`: correr 20 min y restar 5% al promedio, porque un esfuerzo de 20
 *   min se sostiene por encima del umbral real.
 *
 * @param averageBpm FC promedio de la ventana correspondiente al test.
 */
export function calcularLTHR(averageBpm: number, variant: LthrTestVariant): number {
  if (!Number.isFinite(averageBpm) || averageBpm <= 0) {
    throw new Error('La FC promedio del test debe ser un número positivo.');
  }
  const factor =
    variant === '30min'
      ? THRESHOLD_TEST.lthr30MinCorrection
      : THRESHOLD_TEST.lthr20MinCorrection;
  return Math.round(averageBpm * factor);
}

/**
 * Calcula el pace umbral (límite superior de Z4) a partir del test de 20 min.
 *
 * El pace promedio de 20 min es más rápido que el sostenible 60 min, así que se
 * multiplica por 1.05 para "aflojarlo" hasta la velocidad de una hora.
 *
 * @param avgSecPerKm Pace promedio del test, en segundos por km.
 * @returns Pace umbral en segundos por km, redondeado al segundo.
 */
export function calcularPaceUmbral(avgSecPerKm: number): number {
  if (!Number.isFinite(avgSecPerKm) || avgSecPerKm <= 0) {
    throw new Error('El pace del test debe ser un número positivo de segundos por km.');
  }
  return Math.round(avgSecPerKm * THRESHOLD_TEST.pace20MinFactor);
}

/**
 * Genera las 7 zonas de FC en bpm a partir de la LTHR.
 *
 * Los porcentajes son intervalos semiabiertos [min, max), así que los bpm se
 * resuelven así: el piso es el primer entero que alcanza el porcentaje mínimo
 * (`ceil`) y el techo es el último entero que todavía NO alcanza el porcentaje
 * de la zona siguiente. Resultado: rangos contiguos, sin huecos ni solapes.
 *
 * Z1 no tiene piso y Z5c no tiene techo.
 */
export function generarZonasFC(lthr: number): HeartRateZone[] {
  if (!Number.isFinite(lthr) || lthr <= 0) {
    throw new Error('La LTHR debe ser un número positivo.');
  }
  return ZONES.map((zone) => ({
    ...zone,
    bpmMin: zone.lthrMinPct === null ? null : Math.ceil((lthr * zone.lthrMinPct) / 100),
    bpmMax:
      zone.lthrMaxPct === null ? null : Math.ceil((lthr * zone.lthrMaxPct) / 100) - 1,
  }));
}

/**
 * Genera las 7 zonas de pace a partir del pace umbral.
 *
 * Ojo con la orientación: más rápido = MENOS segundos por km. `secPerKmFast` es
 * siempre el número menor del rango.
 */
export function generarZonasPace(thresholdPaceSecPerKm: number): PaceZone[] {
  if (!Number.isFinite(thresholdPaceSecPerKm) || thresholdPaceSecPerKm <= 0) {
    throw new Error('El pace umbral debe ser un número positivo de segundos por km.');
  }
  return ZONES.map((zone) => {
    const factors = PACE_ZONE_FACTORS[zone.id];
    return {
      ...zone,
      secPerKmFast:
        factors.fast === null ? null : Math.round(thresholdPaceSecPerKm * factors.fast),
      secPerKmSlow:
        factors.slow === null ? null : Math.round(thresholdPaceSecPerKm * factors.slow),
    };
  });
}

/**
 * Devuelve la zona que corresponde a un RPE.
 *
 * Este es el camino PRINCIPAL para clasificar una sesión: el RPE no depende de
 * que el reloj haya medido bien.
 */
export function zonaPorRPE(rpe: number): ZoneDefinition {
  const rounded = Math.round(rpe);
  const zone = ZONES.find((z) => rounded >= z.rpeMin && rounded <= z.rpeMax);
  if (!zone) {
    throw new Error(`RPE fuera de escala: ${rpe}. Debe estar entre 1 y 10.`);
  }
  return zone;
}

/**
 * Devuelve la zona que corresponde a una FC, dada la LTHR.
 *
 * Camino SECUNDARIO: usarlo sólo como apoyo, nunca como fuente única.
 */
export function zonaPorFC(bpm: number, lthr: number): ZoneDefinition {
  if (!Number.isFinite(lthr) || lthr <= 0) {
    throw new Error('La LTHR debe ser un número positivo.');
  }
  const pct = (bpm / lthr) * 100;
  // Intervalo semiabierto [min, max): el techo de una zona es el piso de la siguiente.
  const zone = ZONES.find(
    (z) =>
      (z.lthrMinPct === null || pct >= z.lthrMinPct) &&
      (z.lthrMaxPct === null || pct < z.lthrMaxPct),
  );
  // Los rangos cubren toda la recta, así que sólo caería acá un bpm no finito.
  if (!zone) {
    throw new Error(`No se pudo ubicar la FC ${bpm} en ninguna zona.`);
  }
  return zone;
}

/** Busca la definición de una zona por id. */
export function zonaPorId(id: ZoneId): ZoneDefinition {
  const zone = ZONES.find((z) => z.id === id);
  if (!zone) throw new Error(`Zona desconocida: ${id}`);
  return zone;
}

/** Formatea un pace en segundos/km como "m:ss". */
export function formatearPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
