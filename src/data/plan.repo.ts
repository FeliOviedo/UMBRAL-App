/**
 * Persistencia del plan: macrociclo → semanas → días.
 *
 * El dominio genera el plan como un árbol en memoria; acá se aplana en tres
 * tablas y se vuelve a armar al leerlo. La numeración abstracta del dominio
 * (`weekNumber`, `dayIndex`) se aterriza en fechas reales al guardar, que es lo
 * que después permite ubicar el plan en un calendario.
 */

import { supabase } from '@/lib/supabase';
import { calendarizarPlan } from '@/domain/calendar';
import type { MovimientoDia, SaltoDePlan } from '@/domain/planEdit';
import { sumarDias } from '@/lib/format';
import type {
  BasePaceLevel,
  LoadWeek,
  Macrocycle,
  MesocycleScheme,
  PlannedDay,
  TrainingType,
  ZoneId,
} from '@/domain/types';
import type { PlanDayRow, PlanRow, PlanWeekRow } from './database.types';
import { traducirError } from './errors';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de lectura
// ─────────────────────────────────────────────────────────────────────────────

export interface DiaPlanificado {
  id: string;
  diaIndex: number;
  tipo: TrainingType;
  disciplina: PlannedDay['discipline'];
  km: number;
  zonaObjetivo: ZoneId | null;
  rpeObjetivo: number | null;
  notas: string | null;
  fecha: string;
}

export interface SemanaPlanificada {
  id: string;
  numero: number;
  mesociclo: number;
  carga: LoadWeek;
  totalKm: number;
  fechaInicio: string;
  dias: DiaPlanificado[];
}

export interface Plan {
  id: string;
  objetivoId: string;
  esquema: MesocycleScheme;
  diasPorSemana: number;
  /** Días de la semana elegidos para entrenar (0 = lunes). */
  diasEntrenamiento: number[];
  ritmoBase: BasePaceLevel;
  volumenInicialKm: number;
  semanasBase: number;
  semanasTotales: number;
  semanasDescansoPostCarrera: number;
  comprimido: boolean;
  avisos: string[];
  semanas: SemanaPlanificada[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Escritura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guarda un macrociclo completo y lo deja como plan activo.
 *
 * Los planes anteriores del usuario se desactivan primero: el índice parcial
 * `plans_one_active_per_user` sólo admite uno activo, así que insertar sin
 * desactivar fallaría.
 *
 * No hay transacción: el cliente de Supabase no expone uno desde el navegador.
 * El orden está pensado para que una interrupción no deje datos inconsistentes
 * a la vista: el plan se marca activo al final, así que un plan a medio escribir
 * queda invisible para la app en lugar de aparecer incompleto.
 */
export async function guardarPlan(
  userId: string,
  objetivoId: string,
  macrociclo: Macrocycle,
  parametros: {
    esquema: MesocycleScheme;
    diasPorSemana: number;
    diasEntrenamiento?: readonly number[];
    ritmoBase: BasePaceLevel;
    volumenInicialKm: number;
  },
): Promise<Plan> {
  await desactivarPlanes(userId);

  const { data: planRow, error: planError } = await supabase
    .from('plans')
    .insert({
      user_id: userId,
      goal_id: objetivoId,
      scheme: parametros.esquema,
      days_per_week: parametros.diasPorSemana,
      training_days: [...(parametros.diasEntrenamiento ?? [])],
      base_pace_level: parametros.ritmoBase,
      initial_weekly_km: parametros.volumenInicialKm,
      base_weeks: macrociclo.baseWeeks,
      total_weeks: macrociclo.totalWeeks,
      post_race_rest_weeks: macrociclo.postRaceRestWeeks,
      compressed: macrociclo.compressed,
      warnings: macrociclo.warnings,
      is_active: false,
    })
    .select()
    .single();

  if (planError) throw traducirError(planError, 'guardar el plan');

  // El calendario lo resuelve el dominio; acá sólo se le agregan las claves.
  const calendario = calendarizarPlan(macrociclo);

  const { data: weekRows, error: weeksError } = await supabase
    .from('plan_weeks')
    .insert(
      calendario.semanas.map((semana) => ({
        user_id: userId,
        plan_id: planRow.id,
        week_number: semana.weekNumber,
        mesocycle_index: semana.mesocycleIndex,
        load: semana.load,
        total_km: semana.totalKm,
        starts_on: semana.startsOn,
      })),
    )
    .select();

  if (weeksError) throw traducirError(weeksError, 'guardar las semanas del plan');

  const idPorNumeroDeSemana = new Map(weekRows.map((w) => [w.week_number, w.id]));

  const { error: daysError } = await supabase.from('plan_days').insert(
    calendario.dias.map((dia) => ({
      user_id: userId,
      plan_week_id: idPorNumeroDeSemana.get(dia.weekNumber)!,
      day_index: dia.dayIndex,
      type: dia.type,
      discipline: dia.discipline,
      km: dia.km,
      target_zone: dia.targetZone,
      target_rpe: dia.targetRpe,
      notes: dia.notes,
      scheduled_on: dia.scheduledOn,
    })),
  );
  if (daysError) throw traducirError(daysError, 'guardar los días del plan');

  // Recién ahora el plan pasa a ser visible para la app.
  const { error: activarError } = await supabase
    .from('plans')
    .update({ is_active: true })
    .eq('id', planRow.id);
  if (activarError) throw traducirError(activarError, 'activar el plan');

  const plan = await obtenerPlanActivo(userId);
  if (!plan) throw new Error('El plan se guardó pero no se pudo volver a leer.');
  return plan;
}

async function desactivarPlanes(userId: string): Promise<void> {
  const { error } = await supabase
    .from('plans')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw traducirError(error, 'archivar el plan anterior');
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trae el plan activo con todas sus semanas y días.
 *
 * Se hacen tres consultas en lugar de un join anidado porque un plan de 28
 * semanas son ~200 días: el join devolvería el plan repetido en cada fila.
 */
export async function obtenerPlanActivo(userId: string): Promise<Plan | null> {
  const { data: planRow, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (planError) throw traducirError(planError, 'cargar tu plan');
  if (!planRow) return null;

  const { data: weekRows, error: weeksError } = await supabase
    .from('plan_weeks')
    .select('*')
    .eq('plan_id', planRow.id)
    .order('week_number');

  if (weeksError) throw traducirError(weeksError, 'cargar las semanas del plan');

  const weekIds = (weekRows ?? []).map((w) => w.id);
  const dayRows: PlanDayRow[] = [];

  if (weekIds.length > 0) {
    const { data, error } = await supabase
      .from('plan_days')
      .select('*')
      .in('plan_week_id', weekIds)
      .order('scheduled_on');

    if (error) throw traducirError(error, 'cargar los días del plan');
    dayRows.push(...(data ?? []));
  }

  return armarPlan(planRow, weekRows ?? [], dayRows);
}

function armarPlan(plan: PlanRow, weeks: PlanWeekRow[], days: PlanDayRow[]): Plan {
  const diasPorSemana = new Map<string, PlanDayRow[]>();
  for (const day of days) {
    const list = diasPorSemana.get(day.plan_week_id) ?? [];
    list.push(day);
    diasPorSemana.set(day.plan_week_id, list);
  }

  return {
    id: plan.id,
    objetivoId: plan.goal_id,
    esquema: plan.scheme,
    diasPorSemana: plan.days_per_week,
    diasEntrenamiento: plan.training_days ?? [],
    ritmoBase: plan.base_pace_level,
    volumenInicialKm: Number(plan.initial_weekly_km),
    semanasBase: plan.base_weeks,
    semanasTotales: plan.total_weeks,
    semanasDescansoPostCarrera: plan.post_race_rest_weeks,
    comprimido: plan.compressed,
    avisos: plan.warnings ?? [],
    semanas: weeks.map((week) => ({
      id: week.id,
      numero: week.week_number,
      mesociclo: week.mesocycle_index,
      carga: week.load,
      totalKm: Number(week.total_km),
      fechaInicio: week.starts_on,
      dias: (diasPorSemana.get(week.id) ?? [])
        .sort((a, b) => a.day_index - b.day_index)
        .map((day) => ({
          id: day.id,
          diaIndex: day.day_index,
          tipo: day.type,
          disciplina: day.discipline,
          km: Number(day.km),
          zonaObjetivo: day.target_zone,
          rpeObjetivo: day.target_rpe,
          notas: day.notes,
          fecha: day.scheduled_on,
        })),
    })),
  };
}

/** Borra un plan. Las semanas y días caen por `on delete cascade`. */
export async function borrarPlan(planId: string): Promise<void> {
  const { error } = await supabase.from('plans').delete().eq('id', planId);
  if (error) throw traducirError(error, 'borrar el plan');
}

/**
 * Reemplaza los días de una semana por los de una adaptación.
 *
 * Se borra e inserta en lugar de actualizar día por día porque una adaptación
 * puede cambiar la CANTIDAD de días (una sesión omitida deja seis), y hacer
 * coincidir siete filas viejas con seis nuevas por índice es más frágil que
 * rehacer la semana entera.
 *
 * El `scheduled_on` se recalcula desde el lunes de la semana: si la adaptación
 * reordenó los días, sus fechas tienen que seguir el orden nuevo.
 */
export async function reemplazarDiasDeSemana(
  userId: string,
  planWeekId: string,
  dias: readonly PlannedDay[],
): Promise<void> {
  const { data: semana, error: errorSemana } = await supabase
    .from('plan_weeks')
    .select('starts_on')
    .eq('id', planWeekId)
    .single();

  if (errorSemana) throw traducirError(errorSemana, 'buscar la semana a modificar');

  const { error: errorBorrado } = await supabase
    .from('plan_days')
    .delete()
    .eq('plan_week_id', planWeekId);

  if (errorBorrado) throw traducirError(errorBorrado, 'limpiar los días de la semana');

  const { error: errorInsercion } = await supabase.from('plan_days').insert(
    dias.map((dia) => ({
      user_id: userId,
      plan_week_id: planWeekId,
      day_index: dia.dayIndex,
      type: dia.type,
      discipline: dia.discipline,
      km: dia.km,
      target_zone: dia.targetZone ?? null,
      target_rpe: dia.targetRpe ?? null,
      notes: dia.notes ?? null,
      scheduled_on: sumarDias(semana.starts_on, dia.dayIndex),
    })),
  );

  if (errorInsercion) throw traducirError(errorInsercion, 'guardar los días ajustados');

  // El volumen de la semana cambió: se recalcula desde los días.
  const totalKm = Math.round(dias.reduce((sum, d) => sum + d.km, 0) * 10) / 10;
  const { error: errorTotal } = await supabase
    .from('plan_weeks')
    .update({ total_km: totalKm })
    .eq('id', planWeekId);

  if (errorTotal) throw traducirError(errorTotal, 'actualizar el volumen de la semana');
}

/**
 * Traduce los días de una semana guardada a los tipos del dominio.
 *
 * Hace falta cada vez que la UI le pasa una semana al motor de adaptación: el
 * dominio trabaja con `PlannedDay` (campos en inglés, sin ids) y la capa de
 * datos con `DiaPlanificado`. Vive acá, del lado de datos, porque traducir de
 * la base al dominio es exactamente la responsabilidad de esta capa.
 */
export function aDiasDeDominio(dias: readonly DiaPlanificado[]): PlannedDay[] {
  return dias.map((d) => ({
    dayIndex: d.diaIndex,
    type: d.tipo,
    discipline: d.disciplina,
    km: d.km,
    ...(d.zonaObjetivo ? { targetZone: d.zonaObjetivo } : {}),
    ...(d.rpeObjetivo !== null ? { targetRpe: d.rpeObjetivo } : {}),
    ...(d.notas ? { notes: d.notas } : {}),
  }));
}

/**
 * Persiste el movimiento de uno o dos días del plan.
 *
 * Recibe los movimientos ya calculados y validados por el dominio
 * (`planearMovimiento`): acá sólo se escriben. Se actualiza fila por fila y no
 * en lote porque son como mucho dos, y un upsert masivo obligaría a mandar
 * todas las columnas de cada día.
 *
 * Los totales de las semanas afectadas se recalculan al final: si la sesión
 * cruzó de semana, los km se fueron con ella.
 */
export async function moverDiasDelPlan(
  movimientos: readonly MovimientoDia[],
  semanasAfectadas: readonly string[],
): Promise<void> {
  for (const mov of movimientos) {
    const { error } = await supabase
      .from('plan_days')
      .update({
        plan_week_id: mov.semanaId,
        day_index: mov.diaIndex,
        scheduled_on: mov.fecha,
      })
      .eq('id', mov.id);

    if (error) throw traducirError(error, 'mover la sesión');
  }

  await recalcularTotales(semanasAfectadas);
}

/** Vuelve a sumar los km de cada semana desde sus días. */
async function recalcularTotales(semanaIds: readonly string[]): Promise<void> {
  for (const semanaId of semanaIds) {
    const { data, error } = await supabase
      .from('plan_days')
      .select('km')
      .eq('plan_week_id', semanaId);

    if (error) throw traducirError(error, 'recalcular el volumen de la semana');

    const totalKm = Math.round((data ?? []).reduce((sum, d) => sum + Number(d.km), 0) * 10) / 10;

    const { error: errorTotal } = await supabase
      .from('plan_weeks')
      .update({ total_km: totalKm })
      .eq('id', semanaId);

    if (errorTotal) throw traducirError(errorTotal, 'actualizar el volumen de la semana');
  }
}

/**
 * Aplica un salto de mesociclo: borra las semanas salteadas y adelanta el resto.
 *
 * El orden importa. Primero se recalendariza lo que se queda y recién después
 * se borra lo salteado: si el proceso se corta en el medio, el plan queda con
 * semanas de más (visibles y corregibles) en vez de con un agujero de fechas.
 *
 * Los días caen por `on delete cascade` al borrar su semana.
 */
export async function aplicarSaltoDeMesociclo(salto: SaltoDePlan): Promise<void> {
  for (const semana of salto.semanasRecalendarizadas) {
    const { error } = await supabase
      .from('plan_weeks')
      .update({ starts_on: semana.fechaInicio })
      .eq('id', semana.id);

    if (error) throw traducirError(error, 'adelantar las semanas del plan');
  }

  for (const dia of salto.diasRecalendarizados) {
    const { error } = await supabase
      .from('plan_days')
      .update({ scheduled_on: dia.fecha })
      .eq('id', dia.id);

    if (error) throw traducirError(error, 'adelantar los días del plan');
  }

  if (salto.semanasEliminadas.length > 0) {
    const { error } = await supabase
      .from('plan_weeks')
      .delete()
      .in('id', salto.semanasEliminadas);

    if (error) throw traducirError(error, 'saltear las semanas del mesociclo');
  }
}
