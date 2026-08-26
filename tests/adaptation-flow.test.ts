import { describe, expect, it } from 'vitest';
import {
  adaptarPorCargaExterna,
  adaptarPorFeedbackPobre,
  adaptarPorSesionOmitida,
} from '@/domain/adaptation';
import { calcularCargaMetabolica, compararPlanReal } from '@/domain/sessionAnalysis';
import { estadoSupercompensacion, cajaNegra } from '@/domain/analysis';
import { generarMacrociclo } from '@/domain/planner';
import { calendarizarPlan } from '@/domain/calendar';
import { validarMicrociclo } from '@/domain/rules';
import { COMPLEMENTARY_ACTIVITIES } from '@/domain/config';
import type { PlannedDay } from '@/domain/types';

/**
 * El motor sobre un plan REAL, no sobre semanas de laboratorio.
 *
 * Los tests unitarios verifican cada caso por separado con semanas armadas a
 * mano; éste corre el motor sobre las semanas que produce el generador, que es
 * donde aparecen las combinaciones que uno no pensó al escribir el caso.
 */

const macrociclo = generarMacrociclo({
  distance: '10K',
  targetSeconds: 52 * 60,
  startDate: '2026-01-05',
  raceDate: '2026-05-25',
  volumenActualKm: 30,
  ritmoBase: 'promedio',
});

const semanas: PlannedDay[][] = macrociclo.mesocycles.flatMap((m) =>
  m.weeks.map((w) => w.days.map((d) => ({ ...d }))),
);

describe('el motor sobre las semanas que el generador realmente produce', () => {
  it('omitir CUALQUIER día de CUALQUIER semana deja una semana legal', () => {
    for (const semana of semanas) {
      for (const dia of semana) {
        const resultado = adaptarPorSesionOmitida(semana, dia.dayIndex);
        if (resultado.semanaPropuesta) {
          const validacion = validarMicrociclo(resultado.semanaPropuesta);
          expect(validacion.violations).toEqual([]);
        } else {
          // Si no propone nada, tiene que decir que no es aplicable.
          expect(resultado.aplicable).toBe(false);
        }
      }
    }
  });

  it('una carga externa en cualquier día deja una semana legal', () => {
    for (const semana of semanas.slice(0, 8)) {
      for (const dia of semana) {
        for (const carga of [150, 300, 500]) {
          const resultado = adaptarPorCargaExterna(semana, {
            diaActividad: dia.dayIndex,
            cargaMetabolica: carga,
            nombreActividad: 'fútbol',
          });
          if (resultado.semanaPropuesta) {
            expect(validarMicrociclo(resultado.semanaPropuesta).violations).toEqual([]);
          }
        }
      }
    }
  });

  it('un feedback pobre en cualquier sesión deja una semana legal', () => {
    for (const semana of semanas.slice(0, 8)) {
      for (const dia of semana.filter((d) => d.type !== 'D')) {
        const resultado = adaptarPorFeedbackPobre(semana, {
          diaSesion: dia.dayIndex,
          rpeReal: 10,
          rpePlanificado: dia.targetRpe ?? 4,
        });
        if (resultado.semanaPropuesta) {
          expect(validarMicrociclo(resultado.semanaPropuesta).violations).toEqual([]);
        }
      }
    }
  });

  it('una adaptación nunca sube el volumen de la semana', () => {
    // El motor existe para aflojar, no para exigir más.
    for (const semana of semanas.slice(0, 8)) {
      const original = semana.reduce((s, d) => s + d.km, 0);
      for (const dia of semana) {
        const resultado = adaptarPorCargaExterna(semana, {
          diaActividad: dia.dayIndex,
          cargaMetabolica: 500,
          nombreActividad: 'fútbol',
        });
        if (resultado.semanaPropuesta) {
          const nuevo = resultado.semanaPropuesta.reduce((s, d) => s + d.km, 0);
          expect(nuevo).toBeLessThanOrEqual(original);
        }
      }
    }
  });
});

describe('el ciclo completo: entrenar, registrar, adaptar', () => {
  it('un partido de fútbol el sábado se nota en el plan del domingo', () => {
    // Una semana con el largo el domingo, como las que genera el planner.
    const semana: PlannedDay[] = [
      { dayIndex: 0, type: 'D', discipline: 'running', km: 0 },
      { dayIndex: 1, type: 'E', discipline: 'running', km: 12, targetZone: 'Z4', targetRpe: 7 },
      { dayIndex: 2, type: 'R', discipline: 'running', km: 8, targetZone: 'Z1', targetRpe: 2 },
      { dayIndex: 3, type: 'E', discipline: 'running', km: 12, targetZone: 'Z4', targetRpe: 7 },
      { dayIndex: 4, type: 'D', discipline: 'running', km: 0 },
      { dayIndex: 5, type: 'R', discipline: 'running', km: 8, targetZone: 'Z1', targetRpe: 2 },
      { dayIndex: 6, type: 'F', discipline: 'running', km: 18, targetZone: 'Z2', targetRpe: 4 },
    ];

    // 90 minutos de fútbol a RPE 8.
    const futbol = COMPLEMENTARY_ACTIVITIES.find((a) => a.id === 'futbol')!;
    const carga = Math.round(calcularCargaMetabolica(90 * 60, 8) * futbol.factorCarga);
    expect(carga).toBeGreaterThan(400); // pide dos días

    const adaptacion = adaptarPorCargaExterna(semana, {
      diaActividad: 5, // sábado
      cargaMetabolica: carga,
      nombreActividad: 'fútbol',
    });

    // El largo del domingo se afloja.
    expect(adaptacion.accion).toBe('degradar-sesion');
    expect(adaptacion.diasModificados).toEqual([6]);
    expect(adaptacion.semanaPropuesta!.find((d) => d.dayIndex === 6)!.type).toBe('R');
    expect(validarMicrociclo(adaptacion.semanaPropuesta!).violations).toEqual([]);
  });

  it('la carga del fútbol entra al modelo de homeostasis como cualquier sesión', () => {
    const futbol = COMPLEMENTARY_ACTIVITIES.find((a) => a.id === 'futbol')!;
    const cargaFutbol = Math.round(calcularCargaMetabolica(90 * 60, 8) * futbol.factorCarga);

    const soloCorriendo = estadoSupercompensacion([
      { diasAtras: 1, paceSecPerKm: 300, rpe: 5, fcPromedio: null, cargaMetabolica: 200 },
    ]);
    const conFutbol = estadoSupercompensacion([
      { diasAtras: 1, paceSecPerKm: 300, rpe: 5, fcPromedio: null, cargaMetabolica: 200 },
      { diasAtras: 1, paceSecPerKm: null, rpe: 8, fcPromedio: null, cargaMetabolica: cargaFutbol },
    ]);

    expect(conFutbol.fatiga).toBeGreaterThan(soloCorriendo.fatiga);
  });

  it('la comparación plan-real alimenta el feedback pobre con el mismo umbral', () => {
    const planificado = { km: 12, targetRpe: 7 };
    const comparacion = compararPlanReal(planificado, { distanceMeters: 12_000, rpe: 9 });
    expect(comparacion.esfuerzoPorEncimaDeLoEsperado).toBe(true);

    // El motor tiene que ver lo mismo que la pantalla de registro.
    const semana: PlannedDay[] = [
      { dayIndex: 0, type: 'E', discipline: 'running', km: 12, targetRpe: 7 },
      { dayIndex: 1, type: 'F', discipline: 'running', km: 18, targetRpe: 4 },
      { dayIndex: 2, type: 'E', discipline: 'running', km: 12, targetRpe: 7 },
      { dayIndex: 3, type: 'D', discipline: 'running', km: 0 },
      { dayIndex: 4, type: 'R', discipline: 'running', km: 8, targetRpe: 2 },
      { dayIndex: 5, type: 'D', discipline: 'running', km: 0 },
      { dayIndex: 6, type: 'D', discipline: 'running', km: 0 },
    ];
    const adaptacion = adaptarPorFeedbackPobre(semana, {
      diaSesion: 0,
      rpeReal: 9,
      rpePlanificado: 7,
    });
    expect(adaptacion.accion).toBe('insertar-recuperacion');
  });

  it('varias semanas de rodajes al mismo pace producen un veredicto de la caja negra', () => {
    // Un corredor que mejora: mismo pace, RPE que baja.
    const sesiones = Array.from({ length: 12 }, (_, i) => ({
      diasAtras: 40 - i * 3,
      paceSecPerKm: 360,
      rpe: i < 6 ? 6 : 4,
      fcPromedio: i < 6 ? 158 : 150,
      cargaMetabolica: 200,
    }));

    const resultado = cajaNegra(sesiones, 360);
    expect(resultado.veredicto).toBe('progreso');
    expect(resultado.sesionesComparadas).toBe(12);
    expect(resultado.mensaje).toMatch(/frecuencia cardíaca/); // la FC acompaña
  });
});

describe('el calendario y el motor conviven', () => {
  it('reordenar una semana no rompe la asignación de fechas', () => {
    const calendario = calendarizarPlan(macrociclo);
    const semana1 = semanas[0]!;
    const adaptacion = adaptarPorSesionOmitida(semana1, 1);

    // Los días propuestos se reindexan desde 0, que es lo que el repositorio
    // usa para recalcular `scheduled_on` desde el lunes.
    expect(adaptacion.semanaPropuesta!.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(calendario.semanas[0]!.startsOn).toBe('2026-01-05');
  });
});
