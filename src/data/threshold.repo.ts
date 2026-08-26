/**
 * Historial de umbral.
 *
 * Cada re-test agrega una fila; el umbral vigente es el más reciente. Las zonas
 * NO se guardan: se derivan del umbral con `generarZonasFC`/`generarZonasPace`.
 * Guardarlas sería duplicar la metodología en la base y arriesgarse a que
 * quedaran desactualizadas si se recalibra `config.ts`.
 */

import { supabase } from '@/lib/supabase';
import type { ThresholdRow, ThresholdSource } from './database.types';
import { traducirError } from './errors';

export interface Umbral {
  id: string;
  /** FC de umbral en ppm. Dato SECUNDARIO: el reloj mide mal. */
  lthr: number | null;
  /** Pace de umbral en segundos por km. El ancla objetiva más confiable. */
  pacePorKm: number | null;
  origenLthr: ThresholdSource | null;
  origenPace: ThresholdSource | null;
  /** FC promedio cruda del test, antes de la corrección. */
  testFcPromedio: number | null;
  /** Pace promedio crudo del test de 20 min, antes del factor 1.05. */
  testPacePromedio: number | null;
  fecha: string;
  notas: string | null;
}

function aDominio(row: ThresholdRow): Umbral {
  return {
    id: row.id,
    lthr: row.lthr,
    pacePorKm: row.threshold_pace_sec_per_km,
    origenLthr: row.lthr_source,
    origenPace: row.pace_source,
    testFcPromedio: row.test_avg_bpm,
    testPacePromedio: row.test_avg_pace_sec_per_km,
    fecha: row.tested_at,
    notas: row.notes,
  };
}

/** Umbral vigente: el de fecha de test más reciente. `null` si no hay ninguno. */
export async function obtenerUmbralVigente(userId: string): Promise<Umbral | null> {
  const { data, error } = await supabase
    .from('thresholds')
    .select('*')
    .eq('user_id', userId)
    .order('tested_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw traducirError(error, 'cargar tu umbral');
  return data ? aDominio(data) : null;
}

/** Historial completo, del más nuevo al más viejo. Alimenta la re-calibración. */
export async function listarUmbrales(userId: string): Promise<Umbral[]> {
  const { data, error } = await supabase
    .from('thresholds')
    .select('*')
    .eq('user_id', userId)
    .order('tested_at', { ascending: false });

  if (error) throw traducirError(error, 'cargar tu historial de umbral');
  return (data ?? []).map(aDominio);
}

export interface NuevoUmbral {
  lthr?: number | null;
  pacePorKm?: number | null;
  origenLthr?: ThresholdSource | null;
  origenPace?: ThresholdSource | null;
  testFcPromedio?: number | null;
  testPacePromedio?: number | null;
  fecha?: string;
  notas?: string | null;
}

export async function guardarUmbral(userId: string, umbral: NuevoUmbral): Promise<Umbral> {
  if (umbral.lthr == null && umbral.pacePorKm == null) {
    throw new Error('Un umbral necesita al menos la FC o el pace.');
  }

  const { data, error } = await supabase
    .from('thresholds')
    .insert({
      user_id: userId,
      lthr: umbral.lthr ?? null,
      threshold_pace_sec_per_km: umbral.pacePorKm ?? null,
      lthr_source: umbral.origenLthr ?? null,
      pace_source: umbral.origenPace ?? null,
      test_avg_bpm: umbral.testFcPromedio ?? null,
      test_avg_pace_sec_per_km: umbral.testPacePromedio ?? null,
      tested_at: umbral.fecha ?? new Date().toISOString().slice(0, 10),
      notes: umbral.notas ?? null,
    })
    .select()
    .single();

  if (error) throw traducirError(error, 'guardar tu umbral');
  return aDominio(data);
}
