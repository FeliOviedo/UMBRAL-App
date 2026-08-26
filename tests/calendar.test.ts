import { describe, expect, it } from 'vitest';
import { calendarizarPlan } from '@/domain/calendar';
import { generarMacrociclo, type ObjetivoPlan } from '@/domain/planner';
import { validarSecuencia } from '@/domain/rules';

const objetivo: ObjetivoPlan = {
  distance: '10K',
  targetSeconds: 52 * 60,
  // 2026-01-07 es miércoles: el plan tiene que arrancar el lunes 2026-01-05.
  startDate: '2026-01-07',
  raceDate: '2026-05-27',
  volumenActualKm: 20,
  ritmoBase: 'promedio',
};

const macrociclo = generarMacrociclo(objetivo);
const calendario = calendarizarPlan(macrociclo);

describe('calendarizar el plan', () => {
  it('arranca en el lunes de la semana de la fecha de inicio', () => {
    expect(calendario.primerLunes).toBe('2026-01-05');
    expect(calendario.semanas[0]!.startsOn).toBe('2026-01-05');
  });

  it('no corre el arranque al lunes siguiente', () => {
    // Correrlo le comería una semana al plan, que tiene que cerrar contra la
    // fecha de la carrera.
    expect(calendario.primerLunes <= objetivo.startDate).toBe(true);
  });

  it('separa las semanas exactamente 7 días', () => {
    for (let i = 1; i < calendario.semanas.length; i++) {
      const anterior = Date.parse(`${calendario.semanas[i - 1]!.startsOn}T00:00:00Z`);
      const actual = Date.parse(`${calendario.semanas[i]!.startsOn}T00:00:00Z`);
      expect(actual - anterior).toBe(7 * 86_400_000);
    }
  });

  it('todas las semanas caen en lunes', () => {
    for (const semana of calendario.semanas) {
      expect(new Date(`${semana.startsOn}T00:00:00Z`).getUTCDay()).toBe(1);
    }
  });

  it('genera una semana por cada semana del macrociclo', () => {
    expect(calendario.semanas).toHaveLength(macrociclo.totalWeeks);
    expect(calendario.semanas.map((s) => s.weekNumber)).toEqual(
      Array.from({ length: macrociclo.totalWeeks }, (_, i) => i + 1),
    );
  });

  it('genera 7 días por semana, sin faltantes ni repetidos', () => {
    expect(calendario.dias).toHaveLength(macrociclo.totalWeeks * 7);
    for (const semana of calendario.semanas) {
      const dias = calendario.dias.filter((d) => d.weekNumber === semana.weekNumber);
      expect(dias.map((d) => d.dayIndex).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  it('el día 0 de cada semana cae en su lunes', () => {
    for (const semana of calendario.semanas) {
      const lunes = calendario.dias.find(
        (d) => d.weekNumber === semana.weekNumber && d.dayIndex === 0,
      )!;
      expect(lunes.scheduledOn).toBe(semana.startsOn);
    }
  });

  it('las fechas de los días son consecutivas y sin huecos en todo el plan', () => {
    const fechas = calendario.dias.map((d) => d.scheduledOn);
    expect(new Set(fechas).size).toBe(fechas.length);

    for (let i = 1; i < fechas.length; i++) {
      const anterior = Date.parse(`${fechas[i - 1]!}T00:00:00Z`);
      const actual = Date.parse(`${fechas[i]!}T00:00:00Z`);
      expect(actual - anterior).toBe(86_400_000);
    }
  });

  it('preserva el tipo, los km y el RPE objetivo de cada día', () => {
    const primeraSemana = macrociclo.mesocycles[0]!.weeks[0]!;
    const calendarizados = calendario.dias.filter((d) => d.weekNumber === 1);

    expect(calendarizados.map((d) => d.type)).toEqual(primeraSemana.days.map((d) => d.type));
    expect(calendarizados.map((d) => d.km)).toEqual(primeraSemana.days.map((d) => d.km));
    expect(calendarizados.map((d) => d.targetRpe)).toEqual(
      primeraSemana.days.map((d) => d.targetRpe ?? null),
    );
  });

  it('mantiene el orden de las sesiones, así que las reglas siguen valiendo', () => {
    for (const semana of calendario.semanas) {
      const tipos = calendario.dias
        .filter((d) => d.weekNumber === semana.weekNumber)
        .sort((a, b) => a.dayIndex - b.dayIndex)
        .map((d) => d.type);
      expect(validarSecuencia(tipos).valid).toBe(true);
    }
  });

  it('conserva el mesociclo al que pertenece cada semana', () => {
    const porMesociclo = new Map<number, number[]>();
    for (const semana of calendario.semanas) {
      const lista = porMesociclo.get(semana.mesocycleIndex) ?? [];
      lista.push(semana.weekNumber);
      porMesociclo.set(semana.mesocycleIndex, lista);
    }
    // El esquema 3:1 agrupa de a 4 semanas.
    expect(porMesociclo.get(1)).toEqual([1, 2, 3, 4]);
    expect(porMesociclo.get(2)).toEqual([5, 6, 7, 8]);
  });

  it('cruza fines de mes y de año sin desalinearse', () => {
    const largo = calendarizarPlan(
      generarMacrociclo({ ...objetivo, startDate: '2026-11-25', raceDate: '2027-05-12' }),
    );
    expect(largo.primerLunes).toBe('2026-11-23');
    for (const semana of largo.semanas) {
      expect(new Date(`${semana.startsOn}T00:00:00Z`).getUTCDay()).toBe(1);
    }
  });

  it('es determinista', () => {
    expect(calendarizarPlan(macrociclo)).toEqual(calendarizarPlan(macrociclo));
  });
});
