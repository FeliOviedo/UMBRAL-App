/**
 * Parser de KML — ÚLTIMO recurso.
 *
 * El KML es un formato de mapas, no de deporte: sirve para la geometría de la
 * ruta y poco más. Los campos de desnivel suelen venir en 0 o directamente
 * ausentes, y no hay FC ni cadencia.
 *
 * Se soportan las dos formas habituales de traer el tiempo:
 * - `gx:Track`: pares alternados de <when> y <gx:coord>.
 * - `LineString`: sólo coordenadas; sin tiempos no hay pace, sólo trazado.
 */

import type { ImportedActivity, TrackPoint } from '../types';
import {
  distanciaTotal,
  duracionEnMovimiento,
  paceMedio,
  reconciliarDistancia,
  splitsPorKm,
} from './geo';
import { findAll, parseTime, parseXml } from './xml';

export function parseKML(xml: string): ImportedActivity {
  const doc = parseXml(xml);
  const warnings: string[] = [];

  let points = leerGxTrack(doc);
  if (points.length === 0) {
    points = leerLineString(doc);
    if (points.length > 0) {
      warnings.push(
        'El KML no trae marcas de tiempo: se puede dibujar la ruta, pero no ' +
          'calcular pace ni splits. Cargá la duración a mano.',
      );
    }
  }

  if (points.length === 0) {
    throw new Error('El KML no contiene coordenadas de ruta.');
  }

  warnings.push(
    'KML es un formato de mapa: no trae frecuencia cardíaca, cadencia ni ' +
      'desnivel fiable. Si tenés el TCX de la misma actividad, mejor usá ese.',
  );

  const hasTime = points.some((p) => p.time > 0);
  const computedDistanceMeters = distanciaTotal(points);
  const { distanceMeters, warnings: distanceWarnings } =
    reconciliarDistancia(computedDistanceMeters);
  warnings.push(...distanceWarnings);

  const durationSeconds = hasTime ? duracionEnMovimiento(points) : 0;

  return {
    format: 'kml',
    startedAt: hasTime ? points[0]!.time : undefined,
    points,
    distanceMeters,
    computedDistanceMeters: Math.round(computedDistanceMeters),
    durationSeconds: Math.round(durationSeconds),
    paceSecPerKm: hasTime ? paceMedio(distanceMeters, durationSeconds) : null,
    splits: hasTime ? splitsPorKm(points) : [],
    warnings,
  };
}

/** Lee un <gx:Track>: <when> y <gx:coord> alternados y apareados por posición. */
function leerGxTrack(doc: Document): TrackPoint[] {
  const whens = findAll(doc, 'when');
  const coords = findAll(doc, 'coord');
  if (whens.length === 0 || coords.length === 0) return [];

  const points: TrackPoint[] = [];
  const count = Math.min(whens.length, coords.length);
  for (let i = 0; i < count; i++) {
    const time = parseTime(whens[i]!.textContent?.trim());
    // En gx:coord el orden es "lon lat alt", separado por espacios.
    const parts = coords[i]!.textContent?.trim().split(/\s+/) ?? [];
    const lon = Number(parts[0]);
    const lat = Number(parts[1]);
    if (time === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const point: TrackPoint = { lat, lon, time };
    const elevation = Number(parts[2]);
    if (Number.isFinite(elevation) && elevation !== 0) point.elevation = elevation;
    points.push(point);
  }
  return points;
}

/** Lee un <LineString>: sólo geometría, sin tiempos. */
function leerLineString(doc: Document): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const node of findAll(doc, 'coordinates')) {
    const text = node.textContent?.trim();
    if (!text) continue;
    // Tuplas "lon,lat[,alt]" separadas por espacios o saltos de línea.
    for (const tuple of text.split(/\s+/)) {
      const [lonRaw, latRaw, eleRaw] = tuple.split(',');
      const lon = Number(lonRaw);
      const lat = Number(latRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const point: TrackPoint = { lat, lon, time: 0 };
      const elevation = Number(eleRaw);
      if (Number.isFinite(elevation) && elevation !== 0) point.elevation = elevation;
      points.push(point);
    }
  }
  return points;
}
