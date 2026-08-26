/**
 * Parser de TCX — el formato PRINCIPAL de Umbral.
 *
 * Es el único de los tres que trae datos de resumen del Lap: distancia, tiempo,
 * calorías, FC promedio, velocidad media y pasos. De los pasos se deriva la
 * cadencia media.
 *
 * Nota de campo importante: en los TCX del creator "Mi Fitness"/Xiaomi la FC
 * viene SÓLO como un valor de resumen del Lap. Los trackpoints traen apenas
 * Time + Position. Por eso el análisis Pace-FC de Umbral trabaja a nivel de
 * SESIÓN (pace medio vs FC media), que es exactamente lo que la metodología
 * necesita para el ciclo de base.
 */

import type { ImportedActivity, LapSummary, TrackPoint } from '../types';
import {
  cadenciaDesdePasos,
  distanciaTotal,
  duracionEnMovimiento,
  paceMedio,
  reconciliarDistancia,
  splitsPorKm,
} from './geo';
import { findAll, findFirst, numberOf, parseTime, parseXml, textOf } from './xml';

export function parseTCX(xml: string): ImportedActivity {
  const doc = parseXml(xml);
  const warnings: string[] = [];

  const activity = findFirst(doc, 'Activity');
  if (!activity) {
    throw new Error('El TCX no contiene ninguna actividad (<Activity>).');
  }

  // <Creator> envuelve un <Name>; el mismo <Name> aparece en <Author> del archivo.
  const creatorNode = findFirst(activity, 'Creator');
  const creator = creatorNode ? textOf(creatorNode, 'Name') : textOf(doc, 'Name');
  const points = leerTrackpoints(activity);
  if (points.length === 0) {
    throw new Error('El TCX no contiene puntos de ruta con posición y tiempo.');
  }

  const lap = leerResumenDeLaps(activity, warnings);

  const computedDistanceMeters = distanciaTotal(points);
  const { distanceMeters, warnings: distanceWarnings } = reconciliarDistancia(
    computedDistanceMeters,
    lap.distanceMeters,
  );
  warnings.push(...distanceWarnings);

  // El tiempo del lap es el del dispositivo y manda sobre el derivado de los
  // timestamps, que puede quedar corto si hubo huecos de señal.
  const durationSeconds = lap.totalTimeSeconds ?? duracionEnMovimiento(points);

  const cadenceSpm =
    lap.steps !== undefined ? cadenciaDesdePasos(lap.steps, durationSeconds) : undefined;

  if (lap.averageHeartRateBpm !== undefined && !points.some((p) => p.heartRate !== undefined)) {
    warnings.push(
      'El archivo trae la frecuencia cardíaca sólo como promedio de la sesión, ' +
        'no punto a punto. El análisis Pace-FC se hace a nivel de sesión.',
    );
  }

  return {
    format: 'tcx',
    creator,
    startedAt: points[0]!.time,
    points,
    distanceMeters,
    computedDistanceMeters: Math.round(computedDistanceMeters),
    declaredDistanceMeters: lap.distanceMeters,
    durationSeconds: Math.round(durationSeconds),
    paceSecPerKm: paceMedio(distanceMeters, durationSeconds),
    splits: splitsPorKm(points),
    cadenceSpm,
    lap,
    warnings,
  };
}

function leerTrackpoints(activity: Element): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const tp of findAll(activity, 'Trackpoint')) {
    const time = parseTime(textOf(tp, 'Time'));
    const position = findFirst(tp, 'Position');
    if (time === undefined || !position) continue;

    const lat = numberOf(position, 'LatitudeDegrees');
    const lon = numberOf(position, 'LongitudeDegrees');
    if (lat === undefined || lon === undefined) continue;

    const point: TrackPoint = { lat, lon, time };

    const elevation = numberOf(tp, 'AltitudeMeters');
    if (elevation !== undefined) point.elevation = elevation;

    // Sólo algunos relojes la traen por punto; si está, es mejor dato que el promedio.
    const hrNode = findFirst(tp, 'HeartRateBpm');
    const hr = hrNode ? numberOf(hrNode, 'Value') : undefined;
    if (hr !== undefined) point.heartRate = hr;

    points.push(point);
  }
  return points;
}

/**
 * Agrega el resumen de todos los laps de la actividad.
 *
 * Distancia, tiempo, calorías y pasos se suman; la FC promedio se pondera por
 * tiempo, y la máxima es el máximo de las máximas.
 */
function leerResumenDeLaps(activity: Element, warnings: string[]): LapSummary {
  const laps = findAll(activity, 'Lap');
  if (laps.length === 0) {
    warnings.push('El TCX no trae datos de resumen (<Lap>); se calcula todo desde la ruta.');
    return {};
  }

  const summary: LapSummary = {};
  let hrWeightedSum = 0;
  let hrWeight = 0;
  let speedWeightedSum = 0;
  let speedWeight = 0;

  for (const lap of laps) {
    const seconds = numberOf(lap, 'TotalTimeSeconds');
    addTo(summary, 'distanceMeters', numberOf(lap, 'DistanceMeters'));
    addTo(summary, 'totalTimeSeconds', seconds);
    addTo(summary, 'calories', numberOf(lap, 'Calories'));
    // Steps es una extensión del fabricante, no del esquema TCX base.
    addTo(summary, 'steps', numberOf(lap, 'Steps'));

    const avgHrNode = findFirst(lap, 'AverageHeartRateBpm');
    const avgHr = avgHrNode ? numberOf(avgHrNode, 'Value') : undefined;
    if (avgHr !== undefined) {
      const weight = seconds ?? 1;
      hrWeightedSum += avgHr * weight;
      hrWeight += weight;
    }

    const maxHrNode = findFirst(lap, 'MaximumHeartRateBpm');
    const maxHr = maxHrNode ? numberOf(maxHrNode, 'Value') : undefined;
    if (maxHr !== undefined) {
      summary.maximumHeartRateBpm = Math.max(summary.maximumHeartRateBpm ?? 0, maxHr);
    }

    const avgSpeed = numberOf(lap, 'AverageSpeed');
    if (avgSpeed !== undefined) {
      const weight = seconds ?? 1;
      speedWeightedSum += avgSpeed * weight;
      speedWeight += weight;
    }
  }

  if (hrWeight > 0) summary.averageHeartRateBpm = Math.round(hrWeightedSum / hrWeight);
  if (speedWeight > 0) summary.averageSpeedMps = speedWeightedSum / speedWeight;

  return summary;
}

function addTo<K extends keyof LapSummary>(
  summary: LapSummary,
  key: K,
  value: number | undefined,
): void {
  if (value === undefined) return;
  summary[key] = ((summary[key] ?? 0) + value) as LapSummary[K];
}
