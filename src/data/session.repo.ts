/**
 * Sesiones: lo que realmente pasó.
 *
 * Es la tabla más pesada del esquema — una sesión importada de TCX puede traer
 * ~1800 puntos de traza. Por eso hay dos formas de leerlas: `listarSesiones`
 * trae todo MENOS `track`/`splits` (para listas y el dashboard), y
 * `obtenerSesion` trae la fila completa (para el detalle con mapa).
 */

import { supabase } from '@/lib/supabase';
import { calcularCargaMetabolica } from '@/domain/sessionAnalysis';
import type { Discipline, Split, TrackPoint, TrainingType } from '@/domain/types';
import type { SessionRow, SessionSource } from './database.types';
import { traducirError } from './errors';

export interface Sesion {
  id: string;
  planDayId: string | null;
  discipline: Discipline;
  trainingType: TrainingType | null;
  ocurrioEn: string;
  rpe: number;
  sensacion: number | null;
  duracionSeg: number | null;
  distanciaMetros: number | null;
  paceSegPorKm: number | null;
  fcPromedio: number | null;
  fcMaxima: number | null;
  cadenciaSpm: number | null;
  calorias: number | null;
  desnivelM: number | null;
  cargaMetabolica: number | null;
  fuente: SessionSource;
  avisosImportacion: string[];
  imagenPath: string | null;
  notas: string | null;
}

/** Sesión completa, con la traza y los splits. Sólo la trae `obtenerSesion`. */
export interface SesionCompleta extends Sesion {
  track: TrackPoint[];
  splits: Split[];
}

// Columnas livianas: todo menos track/splits, que en una sesión importada
// pueden pesar cientos de KB. Una lista de sesiones no necesita cargarlas.
const COLUMNAS_LIVIANAS =
  'id, user_id, plan_day_id, discipline, training_type, occurred_at, rpe, feeling, ' +
  'duration_seconds, distance_meters, pace_sec_per_km, avg_hr, max_hr, cadence_spm, ' +
  'calories, elevation_gain_m, metabolic_load, source, import_warnings, image_path, notes';

type SessionRowLiviana = Omit<SessionRow, 'track' | 'splits'>;

function aDominio(row: SessionRowLiviana): Sesion {
  return {
    id: row.id,
    planDayId: row.plan_day_id,
    discipline: row.discipline,
    trainingType: row.training_type,
    ocurrioEn: row.occurred_at,
    rpe: row.rpe,
    sensacion: row.feeling,
    duracionSeg: row.duration_seconds,
    distanciaMetros: row.distance_meters,
    paceSegPorKm: row.pace_sec_per_km,
    fcPromedio: row.avg_hr,
    fcMaxima: row.max_hr,
    cadenciaSpm: row.cadence_spm,
    calorias: row.calories,
    desnivelM: row.elevation_gain_m,
    cargaMetabolica: row.metabolic_load,
    fuente: row.source,
    avisosImportacion: row.import_warnings ?? [],
    imagenPath: row.image_path,
    notas: row.notes,
  };
}

/**
 * Lista sesiones del usuario, sin traza ni splits.
 *
 * @param rango Filtro opcional por fecha, en ISO (inclusive ambos extremos).
 *   Se usa para traer sólo la semana en curso en el dashboard y en la vista de
 *   microciclo, en lugar de todo el historial.
 */
export async function listarSesiones(
  userId: string,
  rango?: { desde: string; hasta: string },
): Promise<Sesion[]> {
  let query = supabase.from('sessions').select(COLUMNAS_LIVIANAS).eq('user_id', userId);

  if (rango) {
    query = query.gte('occurred_at', rango.desde).lte('occurred_at', rango.hasta);
  }

  const { data, error } = await query
    .order('occurred_at', { ascending: false })
    .returns<SessionRowLiviana[]>();
  if (error) throw traducirError(error, 'cargar tus sesiones');
  return (data ?? []).map((row: SessionRowLiviana) => aDominio(row));
}

/** Sesión completa, con traza y splits, para la pantalla de detalle. */
export async function obtenerSesion(sessionId: string): Promise<SesionCompleta | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw traducirError(error, 'cargar la sesión');
  if (!data) return null;

  return {
    ...aDominio(data),
    track: (data.track as TrackPoint[] | null) ?? [],
    splits: (data.splits as Split[] | null) ?? [],
  };
}

/** La sesión que ya se registró para un día planificado, si existe. */
export async function obtenerSesionPorDiaPlan(planDayId: string): Promise<Sesion | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select(COLUMNAS_LIVIANAS)
    .eq('plan_day_id', planDayId)
    .maybeSingle()
    .returns<SessionRowLiviana | null>();

  if (error) throw traducirError(error, 'buscar la sesión de ese día');
  return data ? aDominio(data) : null;
}

export interface NuevaSesion {
  planDayId?: string | null;
  discipline?: Discipline;
  trainingType?: TrainingType | null;
  ocurrioEn?: string;
  rpe: number;
  sensacion?: number | null;
  duracionSeg?: number | null;
  distanciaMetros?: number | null;
  paceSegPorKm?: number | null;
  fcPromedio?: number | null;
  fcMaxima?: number | null;
  cadenciaSpm?: number | null;
  calorias?: number | null;
  desnivelM?: number | null;
  fuente?: SessionSource;
  track?: TrackPoint[];
  splits?: Split[];
  avisosImportacion?: string[];
  notas?: string | null;
}

/**
 * Crea una sesión.
 *
 * La carga metabólica se calcula acá, no la manda quien llama: es un derivado
 * puro de duración y RPE (`calcularCargaMetabolica`), y calcularlo en un solo
 * lugar evita que quede desincronizado si dos pantallas arman el payload
 * distinto.
 */
export async function crearSesion(userId: string, sesion: NuevaSesion): Promise<Sesion> {
  const cargaMetabolica =
    sesion.duracionSeg != null ? calcularCargaMetabolica(sesion.duracionSeg, sesion.rpe) : null;

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      plan_day_id: sesion.planDayId ?? null,
      discipline: sesion.discipline ?? 'running',
      training_type: sesion.trainingType ?? null,
      occurred_at: sesion.ocurrioEn ?? new Date().toISOString(),
      rpe: sesion.rpe,
      feeling: sesion.sensacion ?? null,
      duration_seconds: sesion.duracionSeg ?? null,
      distance_meters: sesion.distanciaMetros ?? null,
      pace_sec_per_km: sesion.paceSegPorKm ?? null,
      avg_hr: sesion.fcPromedio ?? null,
      max_hr: sesion.fcMaxima ?? null,
      cadence_spm: sesion.cadenciaSpm ?? null,
      elevation_gain_m: sesion.desnivelM ?? null,
      metabolic_load: cargaMetabolica,
      source: sesion.fuente ?? 'manual',
      track: sesion.track ?? null,
      splits: sesion.splits ?? null,
      import_warnings: sesion.avisosImportacion ?? [],
      notes: sesion.notas ?? null,
    })
    .select(COLUMNAS_LIVIANAS)
    .single()
    .returns<SessionRowLiviana>();

  if (error) throw traducirError(error, 'guardar la sesión');
  return aDominio(data);
}

export async function borrarSesion(sessionId: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
  if (error) throw traducirError(error, 'borrar la sesión');
}

/**
 * Actualiza los campos que la persona confirmó después de revisar la imagen.
 *
 * Sólo se pasan los campos que efectivamente se quieren tocar: pasar
 * `undefined` deja el valor como estaba. Es lo que permite guardar la revisión
 * de la imagen sin pisar lo que ya vino del archivo.
 */
export async function actualizarSesion(
  sessionId: string,
  datos: {
    fcMaxima?: number | null;
    cadenciaSpm?: number | null;
    imagenPath?: string | null;
    notas?: string | null;
  },
): Promise<void> {
  const patch: Partial<SessionRow> = {};
  if (datos.fcMaxima !== undefined) patch.max_hr = datos.fcMaxima;
  if (datos.cadenciaSpm !== undefined) patch.cadence_spm = datos.cadenciaSpm;
  if (datos.imagenPath !== undefined) patch.image_path = datos.imagenPath;
  if (datos.notas !== undefined) patch.notes = datos.notas;

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from('sessions').update(patch).eq('id', sessionId);
  if (error) throw traducirError(error, 'guardar los cambios de la sesión');
}
