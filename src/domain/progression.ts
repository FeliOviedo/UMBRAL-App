/**
 * Progresión de volumen semanal (Tabla 7).
 *
 * En semana de carga se suman km según el ritmo base del corredor y la
 * distancia objetivo. En descarga se baja. Y si hay fatiga externa (fuerza,
 * fútbol, una mala semana), se toma SIEMPRE el límite inferior del rango.
 */

import { DELOAD_VOLUME_FACTOR, PROGRESSION_TABLE, type ProgressionRow } from './config';
import type { BasePaceLevel, LoadWeek, RaceDistance } from './types';

export type { ProgressionRow } from './config';

/** Busca la fila de la Tabla 7 correspondiente a un ritmo base. */
export function filaDeProgresion(level: BasePaceLevel): ProgressionRow {
  const row = PROGRESSION_TABLE.find((r) => r.level === level);
  if (!row) throw new Error(`Ritmo base desconocido: ${level}`);
  return row;
}

/**
 * Ubica el ritmo base del corredor a partir de su pace habitual.
 *
 * Se elige la fila más cercana en pace: la tabla es discreta, así que un pace
 * intermedio se asigna a la referencia que menos lo distorsione.
 */
export function ritmoBasePorPace(paceSecPerKm: number): BasePaceLevel {
  let best = PROGRESSION_TABLE[0]!;
  for (const row of PROGRESSION_TABLE) {
    if (
      Math.abs(row.paceSecPerKm - paceSecPerKm) < Math.abs(best.paceSecPerKm - paceSecPerKm)
    ) {
      best = row;
    }
  }
  return best.level;
}

/**
 * Qué tan agresiva es la progresión dentro del rango de la Tabla 7.
 *
 * El DEFAULT es conservador (piso del rango): es el criterio con el que está
 * construido el ejemplo canónico de la metodología (10K, ritmo Promedio →
 * 20, 22, 24, descarga). Subir al techo es una decisión explícita del usuario.
 */
export type Agresividad = 'conservador' | 'maximo';

/**
 * Km a sumar esta semana de carga.
 *
 * @param hayFatigaExterna Si el usuario viene de carga externa o feedback pobre,
 *   se toma SIEMPRE el piso del rango, sin importar la agresividad elegida. Es
 *   la regla de seguridad de la metodología y no se puede pisar.
 * @returns Km a sumar (puede ser fraccionario: la tabla usa medios km).
 */
export function calcularIncrementoSemanal(
  ritmoBase: BasePaceLevel,
  objetivo: RaceDistance,
  hayFatigaExterna: boolean,
  agresividad: Agresividad = 'conservador',
): number {
  const [min, max] = filaDeProgresion(ritmoBase).increments[objetivo];
  if (hayFatigaExterna) return min;
  return agresividad === 'maximo' ? max : min;
}

/** Rango completo [min, max] de incremento, para mostrarlo en la UI. */
export function rangoIncrementoSemanal(
  ritmoBase: BasePaceLevel,
  objetivo: RaceDistance,
): readonly [number, number] {
  return filaDeProgresion(ritmoBase).increments[objetivo];
}

/**
 * Aplica la progresión al volumen de la semana anterior.
 *
 * - Semana de carga: suma el incremento.
 * - Semana de descarga: baja al 80% (DELOAD_VOLUME_FACTOR), sin sumar nada.
 *
 * El resultado se redondea a medio km, que es la granularidad con la que se
 * planifica de verdad.
 */
export function aplicarProgresion(
  volumenAnteriorKm: number,
  esDescarga: boolean,
  incrementoKm: number,
): number {
  const raw = esDescarga
    ? volumenAnteriorKm * DELOAD_VOLUME_FACTOR
    : volumenAnteriorKm + incrementoKm;
  return Math.round(raw * 2) / 2;
}

/**
 * Calcula el volumen de cada semana de una secuencia de cargas.
 *
 * La descarga se calcula sobre la ÚLTIMA semana de carga, no sobre la anterior
 * inmediata, y la carga que sigue a una descarga retoma desde el pico previo:
 * así el plan progresa en escalera y no se estanca en cada bajada.
 */
export function proyectarVolumen(
  volumenInicialKm: number,
  cargas: readonly LoadWeek[],
  ritmoBase: BasePaceLevel,
  objetivo: RaceDistance,
  hayFatigaExterna = false,
  agresividad: Agresividad = 'conservador',
): number[] {
  const incremento = calcularIncrementoSemanal(
    ritmoBase,
    objetivo,
    hayFatigaExterna,
    agresividad,
  );
  const volumenes: number[] = [];
  let ultimaCarga = volumenInicialKm;

  cargas.forEach((carga, index) => {
    if (carga === 'descarga') {
      volumenes.push(aplicarProgresion(ultimaCarga, true, incremento));
      return;
    }
    // La primera semana arranca en el volumen inicial, sin sumar todavía.
    const base = index === 0 ? volumenInicialKm : ultimaCarga + incremento;
    const value = Math.round(base * 2) / 2;
    volumenes.push(value);
    ultimaCarga = value;
  });

  return volumenes;
}
