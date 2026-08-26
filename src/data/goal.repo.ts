/**
 * Objetivos de carrera.
 *
 * Sólo puede haber uno activo por usuario a la vez, y eso lo garantiza un
 * índice parcial en la base (`goals_one_active_per_user`), no la app. Si dos
 * pestañas intentan crear un objetivo al mismo tiempo, Postgres rechaza la
 * segunda y `traducirError` la convierte en un mensaje entendible.
 */

import { supabase } from '@/lib/supabase';
import type { RaceDistance } from '@/domain/types';
import type { GoalRow, GoalStatus } from './database.types';
import { traducirError } from './errors';

export interface Objetivo {
  id: string;
  distancia: RaceDistance;
  /** Tiempo objetivo en segundos. Ubica al corredor en la Tabla 3. */
  tiempoObjetivoSeg: number;
  fechaCarrera: string;
  fechaInicio: string;
  estado: GoalStatus;
}

function aDominio(row: GoalRow): Objetivo {
  return {
    id: row.id,
    distancia: row.distance,
    tiempoObjetivoSeg: row.target_seconds,
    fechaCarrera: row.race_date,
    fechaInicio: row.start_date,
    estado: row.status,
  };
}

export async function obtenerObjetivoActivo(userId: string): Promise<Objetivo | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'activo')
    .maybeSingle();

  if (error) throw traducirError(error, 'cargar tu objetivo');
  return data ? aDominio(data) : null;
}

export async function listarObjetivos(userId: string): Promise<Objetivo[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('race_date', { ascending: false });

  if (error) throw traducirError(error, 'cargar tus objetivos');
  return (data ?? []).map(aDominio);
}

export interface NuevoObjetivo {
  distancia: RaceDistance;
  tiempoObjetivoSeg: number;
  fechaCarrera: string;
  fechaInicio?: string;
}

export async function crearObjetivo(
  userId: string,
  objetivo: NuevoObjetivo,
): Promise<Objetivo> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      distance: objetivo.distancia,
      target_seconds: objetivo.tiempoObjetivoSeg,
      race_date: objetivo.fechaCarrera,
      start_date: objetivo.fechaInicio ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) throw traducirError(error, 'crear el objetivo');
  return aDominio(data);
}

export async function cambiarEstadoObjetivo(
  objetivoId: string,
  estado: GoalStatus,
): Promise<void> {
  const { error } = await supabase.from('goals').update({ status: estado }).eq('id', objetivoId);
  if (error) throw traducirError(error, 'actualizar el objetivo');
}
