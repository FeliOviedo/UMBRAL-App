/**
 * Aterrizaje del plan en el calendario.
 *
 * El dominio genera el plan con numeración abstracta: semana 1, día 0. Acá esa
 * numeración se convierte en fechas reales. Es lógica pura y vive en el dominio
 * —no en la capa de datos— porque decidir qué día cae cada sesión es una
 * decisión de metodología, no de persistencia: las semanas arrancan el lunes
 * porque el microciclo termina con el largo del fin de semana.
 */

import { lunesDeLaSemana, sumarDias } from '@/lib/format';
import type { Discipline, LoadWeek, Macrocycle, TrainingType, ZoneId } from './types';

export interface SemanaCalendarizada {
  weekNumber: number;
  mesocycleIndex: number;
  load: LoadWeek;
  totalKm: number;
  /** Lunes de esa semana, en ISO. */
  startsOn: string;
}

export interface DiaCalendarizado {
  /** A qué semana pertenece. La capa de datos lo usa para resolver la FK. */
  weekNumber: number;
  dayIndex: number;
  type: TrainingType;
  discipline: Discipline;
  km: number;
  targetZone: ZoneId | null;
  targetRpe: number | null;
  notes: string | null;
  scheduledOn: string;
}

export interface PlanCalendarizado {
  /** Lunes en el que arranca la semana 1. */
  primerLunes: string;
  semanas: SemanaCalendarizada[];
  dias: DiaCalendarizado[];
}

/**
 * Convierte el árbol del macrociclo en dos listas planas con fechas reales.
 *
 * La semana 1 arranca el lunes de la semana en la que cae `startDate`, aunque
 * ese lunes ya haya pasado: el plan tiene que cerrar contra la fecha de la
 * carrera, y correr el arranque al lunes siguiente le comería una semana.
 */
export function calendarizarPlan(macrociclo: Macrocycle): PlanCalendarizado {
  const primerLunes = lunesDeLaSemana(macrociclo.startDate);
  const semanas: SemanaCalendarizada[] = [];
  const dias: DiaCalendarizado[] = [];

  for (const meso of macrociclo.mesocycles) {
    for (const week of meso.weeks) {
      const startsOn = sumarDias(primerLunes, (week.weekNumber - 1) * 7);
      semanas.push({
        weekNumber: week.weekNumber,
        mesocycleIndex: meso.index,
        load: week.load,
        totalKm: week.totalKm,
        startsOn,
      });

      for (const day of week.days) {
        dias.push({
          weekNumber: week.weekNumber,
          dayIndex: day.dayIndex,
          type: day.type,
          discipline: day.discipline,
          km: day.km,
          targetZone: day.targetZone ?? null,
          targetRpe: day.targetRpe ?? null,
          notes: day.notes ?? null,
          scheduledOn: sumarDias(startsOn, day.dayIndex),
        });
      }
    }
  }

  return { primerLunes, semanas, dias };
}
