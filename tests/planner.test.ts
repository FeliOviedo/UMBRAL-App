import { describe, expect, it } from 'vitest';
import { MACROCYCLE_TABLE, MESOCYCLE_SCHEMES, DEFAULT_MESOCYCLE_SCHEME } from '@/domain/config';
import {
  agruparEnMesociclos,
  feasibilidadObjetivo,
  generarMacrociclo,
  generarMesociclo,
  generarMicrociclo,
  nivelPorObjetivo,
  plantillaPara,
  secuenciaDeCargas,
  semanasEntre,
  type ObjetivoPlan,
} from '@/domain/planner';
import { validarMicrociclo } from '@/domain/rules';

describe('Tabla 3 — nivel por tiempo objetivo', () => {
  it.each([
    ['5K' as const, 35 * 60, 3],
    ['5K' as const, 25 * 60, 4],
    ['5K' as const, 17 * 60, 6],
    ['10K' as const, 75 * 60, 3],
    ['10K' as const, 45 * 60, 5],
    ['21K' as const, 165 * 60, 3],
    ['42K' as const, 345 * 60, 3],
    ['42K' as const, 165 * 60, 6],
  ])('%s en %i s → %i días recomendados', (distance, seconds, expected) => {
    expect(nivelPorObjetivo(distance, seconds).diasRecomendados).toBe(expected);
  });

  it('un objetivo más lento que toda la tabla cae en la fila de 3 días', () => {
    expect(nivelPorObjetivo('10K', 120 * 60).diasRecomendados).toBe(3);
  });

  it('un objetivo más rápido que toda la tabla cae en la fila de 6 días', () => {
    expect(nivelPorObjetivo('10K', 25 * 60).diasRecomendados).toBe(6);
  });

  it('expone el rango cuando la tabla da uno (3-4, 4-5)', () => {
    const nivel = nivelPorObjetivo('10K', 60 * 60);
    expect([nivel.daysMin, nivel.daysMax]).toEqual([3, 4]);
  });
});

describe('feasibilidad del objetivo', () => {
  it('es de riesgo bajo si hay al menos las semanas del plan ideal', () => {
    const result = feasibilidadObjetivo('10K', 20);
    expect(result.viable).toBe(true);
    expect(result.riesgo).toBe('bajo');
    expect(result.semanasIdeales).toBe(MACROCYCLE_TABLE['10K'].totalWeeks);
  });

  it('es de riesgo medio si hay que comprimir moderadamente', () => {
    const result = feasibilidadObjetivo('10K', 14);
    expect(result.viable).toBe(true);
    expect(result.riesgo).toBe('medio');
    expect(result.mensaje).toMatch(/comprime/);
  });

  it('es de riesgo alto y no viable si el plazo es demasiado corto', () => {
    const result = feasibilidadObjetivo('42K', 8);
    expect(result.viable).toBe(false);
    expect(result.riesgo).toBe('alto');
    expect(result.mensaje).toMatch(/lesión/);
  });

  it('explica siempre en español, con los dos números a la vista', () => {
    const result = feasibilidadObjetivo('21K', 12);
    expect(result.mensaje).toContain('12');
    expect(result.mensaje).toContain('24');
  });
});

describe('semanas entre fechas', () => {
  it('cuenta semanas completas', () => {
    expect(semanasEntre('2026-01-01', '2026-01-15')).toBe(2);
    expect(semanasEntre('2026-01-01', '2026-01-14')).toBe(1);
  });

  it('devuelve 0 si la fecha objetivo ya pasó', () => {
    expect(semanasEntre('2026-06-01', '2026-01-01')).toBe(0);
  });

  it('rechaza fechas mal formadas', () => {
    expect(() => semanasEntre('ayer', '2026-01-01')).toThrow(/YYYY-MM-DD/);
  });
});

describe('Tabla 5 — secuencia de cargas', () => {
  it('repite el patrón del esquema hasta cubrir las semanas', () => {
    expect(secuenciaDeCargas('3:1', 6)).toEqual([
      'carga',
      'carga+',
      'carga++',
      'descarga',
      'carga',
      'carga+',
    ]);
  });

  it('cada esquema tiene su patrón y su nivel', () => {
    expect(MESOCYCLE_SCHEMES['1:1'].weeks).toHaveLength(4);
    expect(MESOCYCLE_SCHEMES['2:1'].weeks).toHaveLength(3);
    expect(MESOCYCLE_SCHEMES['3:1'].weeks).toHaveLength(4);
    expect(MESOCYCLE_SCHEMES[DEFAULT_MESOCYCLE_SCHEME].level).toBe('Bajo');
  });

  it('todo esquema termina en descarga', () => {
    for (const scheme of Object.values(MESOCYCLE_SCHEMES)) {
      expect(scheme.weeks[scheme.weeks.length - 1]).toBe('descarga');
    }
  });
});

describe('Tabla 4 — elección de plantilla', () => {
  it.each([3, 4, 5, 6])('devuelve la plantilla de %i días', (dias) => {
    expect(plantillaPara(dias)).toHaveLength(7);
  });

  it('acota fuera de rango al piso y al techo de la tabla', () => {
    expect(plantillaPara(1)).toEqual(plantillaPara(3));
    expect(plantillaPara(9)).toEqual(plantillaPara(6));
  });
});

describe('generación del microciclo', () => {
  it('reparte el volumen objetivo entre los días y cierra el total exacto', () => {
    const semana = generarMicrociclo({
      weekNumber: 1,
      load: 'carga',
      diasPorSemana: 4,
      volumenObjetivoKm: 30,
    });
    expect(semana.totalKm).toBe(30);
    expect(semana.days).toHaveLength(7);
  });

  it('deja los días de descanso en 0 km', () => {
    const semana = generarMicrociclo({
      weekNumber: 1,
      load: 'carga',
      diasPorSemana: 4,
      volumenObjetivoKm: 30,
    });
    expect(semana.days.filter((d) => d.type === 'D').every((d) => d.km === 0)).toBe(true);
  });

  it('le da al largo más km que a cualquier otra sesión', () => {
    const semana = generarMicrociclo({
      weekNumber: 1,
      load: 'carga',
      diasPorSemana: 5,
      volumenObjetivoKm: 40,
    });
    const largo = semana.days.find((d) => d.type === 'F')!;
    for (const day of semana.days.filter((d) => d.type !== 'F')) {
      expect(largo.km).toBeGreaterThan(day.km);
    }
  });

  it('asigna zona y RPE objetivo a cada sesión que los tiene', () => {
    const semana = generarMicrociclo({
      weekNumber: 1,
      load: 'carga',
      diasPorSemana: 4,
      volumenObjetivoKm: 30,
    });
    const largo = semana.days.find((d) => d.type === 'F')!;
    const especifico = semana.days.find((d) => d.type === 'E')!;
    const descanso = semana.days.find((d) => d.type === 'D')!;

    expect(largo.targetZone).toBe('Z2');
    expect(largo.targetRpe).toBe(4);
    expect(especifico.targetZone).toBe('Z4');
    expect(especifico.targetRpe).toBe(7);
    expect(descanso.targetZone).toBeUndefined();
    expect(descanso.targetRpe).toBeUndefined();
  });

  it('devuelve siempre una semana válida, incluso con la plantilla de 6 días', () => {
    for (const dias of [3, 4, 5, 6]) {
      const semana = generarMicrociclo({
        weekNumber: 1,
        load: 'carga',
        diasPorSemana: dias,
        volumenObjetivoKm: 35,
      });
      expect(validarMicrociclo(semana.days).valid).toBe(true);
    }
  });

  it('marca todas las sesiones como running en el MVP', () => {
    const semana = generarMicrociclo({
      weekNumber: 1,
      load: 'carga',
      diasPorSemana: 4,
      volumenObjetivoKm: 30,
    });
    expect(semana.days.every((d) => d.discipline === 'running')).toBe(true);
  });
});

describe('generación del mesociclo', () => {
  it('produce una semana por cada carga del esquema', () => {
    const meso = generarMesociclo({
      index: 1,
      scheme: '3:1',
      diasPorSemana: 4,
      volumenInicialKm: 20,
      ritmoBase: 'promedio',
      objetivo: '10K',
    });
    expect(meso.weeks).toHaveLength(4);
    expect(meso.weeks.map((w) => w.load)).toEqual(['carga', 'carga+', 'carga++', 'descarga']);
  });

  it('la semana de descarga tiene menos volumen que la de pico', () => {
    const meso = generarMesociclo({
      index: 1,
      scheme: '3:1',
      diasPorSemana: 4,
      volumenInicialKm: 20,
      ritmoBase: 'promedio',
      objetivo: '10K',
    });
    expect(meso.weeks[3]!.totalKm).toBeLessThan(meso.weeks[2]!.totalKm);
  });

  it('agrupa semanas sueltas en mesociclos del largo del esquema', () => {
    const meso = generarMesociclo({
      index: 1,
      scheme: '2:1',
      diasPorSemana: 4,
      volumenInicialKm: 20,
      ritmoBase: 'promedio',
      objetivo: '10K',
    });
    const grupos = agruparEnMesociclos([...meso.weeks, ...meso.weeks], '2:1');
    expect(grupos).toHaveLength(2);
    expect(grupos[0]!.weeks).toHaveLength(3);
  });
});

describe('generación del macrociclo', () => {
  const base: ObjetivoPlan = {
    distance: '10K',
    targetSeconds: 52 * 60,
    startDate: '2026-01-05',
    raceDate: '2026-05-25', // 20 semanas
    volumenActualKm: 20,
    ritmoBase: 'promedio',
  };

  it('usa el plan ideal de la Tabla 6 cuando hay tiempo de sobra', () => {
    const plan = generarMacrociclo(base);
    expect(plan.totalWeeks).toBe(MACROCYCLE_TABLE['10K'].totalWeeks);
    expect(plan.baseWeeks).toBe(MACROCYCLE_TABLE['10K'].baseWeeks);
    expect(plan.postRaceRestWeeks).toBe(MACROCYCLE_TABLE['10K'].restWeeksMin);
    expect(plan.compressed).toBe(false);
    expect(plan.warnings).toHaveLength(0);
  });

  it('genera una semana por cada semana del plan', () => {
    const plan = generarMacrociclo(base);
    const semanas = plan.mesocycles.flatMap((m) => m.weeks);
    expect(semanas).toHaveLength(plan.totalWeeks);
    expect(semanas.map((w) => w.weekNumber)).toEqual(
      Array.from({ length: plan.totalWeeks }, (_, i) => i + 1),
    );
  });

  it('toda semana del plan respeta R1-R4', () => {
    for (const week of generarMacrociclo(base).mesocycles.flatMap((m) => m.weeks)) {
      expect(validarMicrociclo(week.days).valid).toBe(true);
    }
  });

  it('usa 3:1 como esquema por defecto', () => {
    expect(generarMacrociclo(base).mesocycles[0]!.scheme).toBe('3:1');
  });

  it('comprime el plan y avisa si la fecha deja menos semanas', () => {
    const plan = generarMacrociclo({ ...base, raceDate: '2026-04-06' }); // ~13 semanas
    expect(plan.compressed).toBe(true);
    expect(plan.totalWeeks).toBeLessThan(MACROCYCLE_TABLE['10K'].totalWeeks);
    expect(plan.baseWeeks).toBeLessThan(MACROCYCLE_TABLE['10K'].baseWeeks);
    expect(plan.warnings.join(' ')).toMatch(/comprime/);
  });

  it('marca riesgo alto si la compresión es extrema', () => {
    const plan = generarMacrociclo({ ...base, distance: '42K', raceDate: '2026-03-02' });
    expect(plan.warnings.join(' ')).toMatch(/lesión/);
  });

  it('avisa y usa el plan ideal si la carrera ya pasó', () => {
    const plan = generarMacrociclo({ ...base, raceDate: '2025-12-01' });
    expect(plan.compressed).toBe(false);
    expect(plan.warnings.join(' ')).toMatch(/no deja ninguna semana/);
  });

  it('el volumen crece a lo largo del plan', () => {
    const semanas = generarMacrociclo(base).mesocycles.flatMap((m) => m.weeks);
    const primeraCarga = semanas.find((w) => w.load === 'carga')!;
    const ultimaCarga = [...semanas].reverse().find((w) => w.load === 'carga++')!;
    expect(ultimaCarga.totalKm).toBeGreaterThan(primeraCarga.totalKm);
  });

  it('usa los días por semana de la Tabla 3 si no se indican otros', () => {
    // 10K en 52 min → 4 días.
    const semana = generarMacrociclo(base).mesocycles[0]!.weeks[0]!;
    const entrenamientos = semana.days.filter((d) => d.type !== 'D').length;
    expect(entrenamientos).toBeGreaterThanOrEqual(3);
    expect(entrenamientos).toBeLessThanOrEqual(4);
  });

  it('respeta los días por semana que pida el usuario', () => {
    const plan = generarMacrociclo({ ...base, diasPorSemana: 6 });
    const semana = plan.mesocycles[0]!.weeks[0]!;
    expect(semana.days.filter((d) => d.type !== 'D').length).toBeGreaterThanOrEqual(5);
  });

  it('es determinista: dos corridas con la misma entrada dan el mismo plan', () => {
    expect(generarMacrociclo(base)).toEqual(generarMacrociclo(base));
  });
});
