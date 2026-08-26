/**
 * Parser de GPX — formato de RESPALDO.
 *
 * Trae lat/lon/time y poco más. La distancia se calcula por Haversine, la
 * duración desde los timestamps y el pace de ahí. Puede no traer FC ni
 * elevación: la app tiene que funcionar igual, apoyada en el RPE que el usuario
 * carga a mano.
 */

import type { ImportedActivity, TrackPoint } from '../types';
import {
  distanciaTotal,
  duracionEnMovimiento,
  paceMedio,
  reconciliarDistancia,
  splitsPorKm,
} from './geo';
import { findAll, numberOf, parseTime, parseXml, textOf } from './xml';

export function parseGPX(xml: string): ImportedActivity {
  const doc = parseXml(xml);
  const warnings: string[] = [];

  const points = leerTrackpoints(doc);
  if (points.length === 0) {
    throw new Error('El GPX no contiene puntos de ruta (<trkpt>) con posición y tiempo.');
  }

  const creator = doc.documentElement?.getAttribute('creator') ?? undefined;

  // Algunos GPX declaran la distancia en una extensión; si no, se calcula.
  const declared = numberOf(doc, 'distance');
  const computedDistanceMeters = distanciaTotal(points);
  const { distanceMeters, warnings: distanceWarnings } = reconciliarDistancia(
    computedDistanceMeters,
    declared,
  );
  warnings.push(...distanceWarnings);

  const durationSeconds = duracionEnMovimiento(points);

  if (!points.some((p) => p.heartRate !== undefined)) {
    warnings.push('El GPX no trae frecuencia cardíaca. La intensidad se registra por RPE.');
  }
  if (!points.some((p) => p.elevation !== undefined)) {
    warnings.push('El GPX no trae elevación; no se puede calcular el desnivel.');
  }

  return {
    format: 'gpx',
    creator: creator ?? undefined,
    startedAt: points[0]!.time,
    points,
    distanceMeters,
    computedDistanceMeters: Math.round(computedDistanceMeters),
    declaredDistanceMeters: declared,
    durationSeconds: Math.round(durationSeconds),
    paceSecPerKm: paceMedio(distanceMeters, durationSeconds),
    splits: splitsPorKm(points),
    warnings,
  };
}

function leerTrackpoints(doc: Document): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const trkpt of findAll(doc, 'trkpt')) {
    const lat = Number(trkpt.getAttribute('lat'));
    const lon = Number(trkpt.getAttribute('lon'));
    const time = parseTime(textOf(trkpt, 'time'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || time === undefined) continue;

    const point: TrackPoint = { lat, lon, time };

    const elevation = numberOf(trkpt, 'ele');
    if (elevation !== undefined) point.elevation = elevation;

    // La FC vive en la extensión de Garmin: <gpxtpx:hr>.
    const hr = numberOf(trkpt, 'hr');
    if (hr !== undefined) point.heartRate = hr;

    points.push(point);
  }
  return points;
}
