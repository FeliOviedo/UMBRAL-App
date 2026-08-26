/**
 * Punto de entrada de la importación de archivos de reloj.
 *
 * Prioridad de formatos: TCX > GPX > KML. El TCX es el único que trae datos de
 * resumen (FC media, pasos, calorías); los otros dos sólo geometría.
 */

import type { ImportedActivity, TrackFileFormat } from '../types';
import { parseGPX } from './gpx';
import { parseKML } from './kml';
import { parseTCX } from './tcx';

export * from './geo';
export { parseGPX } from './gpx';
export { parseKML } from './kml';
export { parseTCX } from './tcx';

/**
 * Detecta el formato por la extensión del nombre y, si no alcanza, por el
 * contenido del XML.
 */
export function detectarFormato(content: string, fileName?: string): TrackFileFormat {
  const ext = fileName?.toLowerCase().split('.').pop();
  if (ext === 'tcx' || ext === 'gpx' || ext === 'kml') return ext;

  // Sniff sobre el arranque del archivo: alcanza para distinguir los tres.
  const head = content.slice(0, 2048);
  if (/<TrainingCenterDatabase/i.test(head)) return 'tcx';
  if (/<gpx[\s>]/i.test(head)) return 'gpx';
  if (/<kml[\s>]/i.test(head)) return 'kml';

  throw new Error('No se reconoce el formato del archivo. Se aceptan TCX, GPX y KML.');
}

/** Parsea un archivo de actividad, detectando el formato si no se indica. */
export function parseActivityFile(
  content: string,
  options: { fileName?: string; format?: TrackFileFormat } = {},
): ImportedActivity {
  const format = options.format ?? detectarFormato(content, options.fileName);
  switch (format) {
    case 'tcx':
      return parseTCX(content);
    case 'gpx':
      return parseGPX(content);
    case 'kml':
      return parseKML(content);
  }
}

/**
 * Elige el archivo más informativo cuando el usuario sube varios de la misma
 * actividad: gana el TCX, después el GPX, y el KML sólo si no hay otra cosa.
 */
export function elegirMejorFormato(
  formats: readonly TrackFileFormat[],
): TrackFileFormat | undefined {
  const priority: readonly TrackFileFormat[] = ['tcx', 'gpx', 'kml'];
  return priority.find((f) => formats.includes(f));
}
