/**
 * Cálculos geográficos y derivados de la traza. Funciones puras, sin dependencias
 * del formato de archivo: reciben puntos ya normalizados.
 */

import { IMPORT_CONFIG } from '../config';
import type { Split, TrackPoint } from '../types';

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Distancia en metros entre dos coordenadas por la fórmula de Haversine.
 *
 * Alcanza de sobra para trazas de running: el error frente a un modelo elipsoidal
 * es de centímetros en tramos de segundos.
 */
export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * IMPORT_CONFIG.earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Suma la distancia de toda la traza, punto a punto. */
export function distanciaTotal(points: readonly TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    total += haversine(prev.lat, prev.lon, curr.lat, curr.lon);
  }
  return total;
}

/**
 * Duración de la actividad en segundos.
 *
 * Los huecos mayores a `maxGapSecondsBetweenPoints` se descuentan: son pausas
 * (semáforo, el reloj perdió señal) y no deberían inflar el tiempo ni ensuciar
 * el pace medio.
 */
export function duracionEnMovimiento(points: readonly TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const gap = (points[i]!.time - points[i - 1]!.time) / 1000;
    if (gap > 0 && gap <= IMPORT_CONFIG.maxGapSecondsBetweenPoints) {
      total += gap;
    }
  }
  return total;
}

/**
 * Parte la traza en splits de 1 km.
 *
 * El último split puede quedar incompleto; se devuelve igual con sus metros
 * reales, y su `paceSecPerKm` se extrapola al km entero para que sea comparable.
 */
export function splitsPorKm(points: readonly TrackPoint[]): Split[] {
  const splits: Split[] = [];
  if (points.length < 2) return splits;

  let kmIndex = 1;
  let metersInSplit = 0;
  let splitStartTime = points[0]!.time;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const segmentMeters = haversine(prev.lat, prev.lon, curr.lat, curr.lon);
    const segmentSeconds = (curr.time - prev.time) / 1000;

    if (metersInSplit + segmentMeters < 1000) {
      metersInSplit += segmentMeters;
      continue;
    }

    // El km se completa dentro de este segmento: se interpola el instante exacto.
    let remaining = segmentMeters;
    let segStartTime = prev.time;
    while (metersInSplit + remaining >= 1000) {
      const metersNeeded = 1000 - metersInSplit;
      // Velocidad constante dentro del segmento: el tiempo se reparte por metros.
      const elapsedSeconds = segmentSeconds * (metersNeeded / segmentMeters);
      const crossingTime = segStartTime + elapsedSeconds * 1000;
      const seconds = (crossingTime - splitStartTime) / 1000;

      splits.push({
        km: kmIndex,
        seconds: Math.round(seconds),
        paceSecPerKm: Math.round(seconds),
        meters: 1000,
      });

      kmIndex += 1;
      splitStartTime = crossingTime;
      segStartTime = crossingTime;
      remaining -= metersNeeded;
      metersInSplit = 0;
    }
    metersInSplit = remaining;
  }

  // Cola parcial: sólo se reporta si tiene entidad suficiente para ser útil.
  if (metersInSplit > 1) {
    const seconds = (points[points.length - 1]!.time - splitStartTime) / 1000;
    splits.push({
      km: kmIndex,
      seconds: Math.round(seconds),
      paceSecPerKm: Math.round((seconds / metersInSplit) * 1000),
      meters: Math.round(metersInSplit),
    });
  }

  return splits;
}

/**
 * Cadencia media en pasos por minuto, derivada de los pasos totales del lap.
 *
 * Los TCX de reloj traen `Steps` como total de la sesión, no como serie, así que
 * lo único honesto que se puede reportar es el promedio.
 */
export function cadenciaDesdePasos(steps: number, durationSeconds: number): number | undefined {
  if (!Number.isFinite(steps) || steps <= 0) return undefined;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return undefined;
  return Math.round(steps / (durationSeconds / 60));
}

/** Pace medio en segundos por km. `null` si no hay distancia útil. */
export function paceMedio(distanceMeters: number, durationSeconds: number): number | null {
  if (distanceMeters <= 0 || durationSeconds <= 0) return null;
  return Math.round((durationSeconds / distanceMeters) * 1000);
}

export interface ReconciledDistance {
  distanceMeters: number;
  warnings: string[];
}

/**
 * Decide qué distancia usar entre la calculada por Haversine y la declarada por
 * el archivo.
 *
 * Si difieren más que la tolerancia, gana la declarada por el dispositivo (el
 * reloj filtra el ruido GPS que la suma punto a punto acumula) y se deja un
 * aviso para que el usuario sepa por qué el número no coincide con el mapa.
 */
export function reconciliarDistancia(
  computedMeters: number,
  declaredMeters?: number,
): ReconciledDistance {
  const warnings: string[] = [];
  if (declaredMeters === undefined || declaredMeters <= 0) {
    return { distanceMeters: Math.round(computedMeters), warnings };
  }
  if (computedMeters <= 0) {
    return { distanceMeters: Math.round(declaredMeters), warnings };
  }

  const diff = Math.abs(computedMeters - declaredMeters) / declaredMeters;
  if (diff > IMPORT_CONFIG.distanceReconciliationTolerance) {
    warnings.push(
      `La distancia del archivo (${(declaredMeters / 1000).toFixed(2)} km) difiere ` +
        `${(diff * 100).toFixed(1)}% de la calculada sobre la ruta ` +
        `(${(computedMeters / 1000).toFixed(2)} km). Se usa la del dispositivo.`,
    );
  }
  return { distanceMeters: Math.round(declaredMeters), warnings };
}
