/**
 * Historial de decisiones del motor de adaptación.
 *
 * Una adaptación se guarda PROPUESTA (`applied = false`) y sólo pasa a aplicada
 * cuando el usuario la confirma en la pantalla de re-calibración. Nada cambia
 * el plan sin que alguien haya visto el antes y el después.
 *
 * Se guarda incluso lo que no cambia nada (`accion: 'ninguna'`): que el motor
 * mirara y decidiera no tocar el plan también es información, y es lo que hace
 * que el usuario entienda que la app está prestando atención.
 */

import { supabase } from '@/lib/supabase';
import type { Adaptacion } from '@/domain/adaptation';
import type { PlannedDay } from '@/domain/types';
import type { AdaptationRow } from './database.types';
import { traducirError } from './errors';

export interface AdaptacionGuardada {
  id: string;
  planWeekId: string | null;
  motivo: Adaptacion['motivo'];
  accion: Adaptacion['accion'];
  titulo: string;
  explicacion: string;
  snapshotAntes: PlannedDay[] | null;
  snapshotDespues: PlannedDay[] | null;
  sesionDisparadora: string | null;
  aplicada: boolean;
  aplicadaEn: string | null;
  /** Cuándo el usuario la rechazó. Excluyente con `aplicada`. */
  descartadaEn: string | null;
  creadaEn: string;
}

function aDominio(row: AdaptationRow): AdaptacionGuardada {
  return {
    id: row.id,
    planWeekId: row.plan_week_id,
    motivo: row.reason,
    accion: row.action,
    titulo: row.title,
    explicacion: row.explanation,
    snapshotAntes: row.snapshot_antes,
    snapshotDespues: row.snapshot_despues,
    sesionDisparadora: row.trigger_session_id,
    aplicada: row.applied,
    aplicadaEn: row.applied_at,
    descartadaEn: row.dismissed_at,
    creadaEn: row.created_at,
  };
}

/** Guarda una propuesta del motor. No toca el plan: sólo la registra. */
export async function guardarPropuesta(
  userId: string,
  adaptacion: Adaptacion,
  contexto: {
    planWeekId?: string | null;
    semanaOriginal?: readonly PlannedDay[] | null;
    sesionDisparadora?: string | null;
  } = {},
): Promise<AdaptacionGuardada> {
  const { data, error } = await supabase
    .from('adaptations')
    .insert({
      user_id: userId,
      plan_week_id: contexto.planWeekId ?? null,
      reason: adaptacion.motivo,
      action: adaptacion.accion,
      title: adaptacion.titulo,
      explanation: adaptacion.explicacion,
      snapshot_antes: contexto.semanaOriginal ? [...contexto.semanaOriginal] : null,
      snapshot_despues: adaptacion.semanaPropuesta,
      trigger_session_id: contexto.sesionDisparadora ?? null,
      applied: false,
    })
    .select()
    .single();

  if (error) throw traducirError(error, 'guardar la propuesta de ajuste');
  return aDominio(data);
}

/** Marca una propuesta como aplicada. El cambio del plan lo hace `plan.repo`. */
export async function marcarComoAplicada(adaptacionId: string): Promise<void> {
  const { error } = await supabase
    .from('adaptations')
    .update({ applied: true, applied_at: new Date().toISOString() })
    .eq('id', adaptacionId);

  if (error) throw traducirError(error, 'confirmar el ajuste');
}

/**
 * Descarta una propuesta que el usuario no quiso aplicar.
 *
 * Marca, no borra. Que el motor haya propuesto algo y la persona haya dicho que
 * no es información: dentro de tres meses es lo único que puede explicar por qué
 * una semana quedó como quedó. Deja de aparecer entre las pendientes, pero sigue
 * en el historial.
 */
export async function descartarPropuesta(adaptacionId: string): Promise<void> {
  const { error } = await supabase
    .from('adaptations')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', adaptacionId);
  if (error) throw traducirError(error, 'descartar el ajuste');
}

/** Propuestas todavía sin resolver, de la más nueva a la más vieja. */
export async function listarPropuestasPendientes(
  userId: string,
): Promise<AdaptacionGuardada[]> {
  const { data, error } = await supabase
    .from('adaptations')
    .select('*')
    .eq('user_id', userId)
    .eq('applied', false)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false });

  if (error) throw traducirError(error, 'cargar los ajustes propuestos');
  return (data ?? []).map(aDominio);
}

/**
 * Historial completo: aplicadas, descartadas y pendientes.
 *
 * Es el registro de por qué el plan es como es. Incluye lo que se rechazó, que
 * suele ser lo más informativo de los tres.
 */
export async function listarAdaptaciones(
  userId: string,
  limite = 50,
): Promise<AdaptacionGuardada[]> {
  const { data, error } = await supabase
    .from('adaptations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) throw traducirError(error, 'cargar el historial de ajustes');
  return (data ?? []).map(aDominio);
}
