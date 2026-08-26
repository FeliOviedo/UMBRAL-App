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
