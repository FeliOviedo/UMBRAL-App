import { describe, expect, it } from 'vitest';
import {
  acomodarSesionesEnDias,
  MAX_DIAS_ENTRENAMIENTO,
  MIN_DIAS_ENTRENAMIENTO,
  normalizarDiasDisponibles,
  plantillaParaDias,
  sesionesDePlantilla,
  validarDiasDisponibles,
} from '@/domain/trainingDays';
import { generarMacrociclo } from '@/domain/planner';
import { validarSecuencia } from '@/domain/rules';
import { MICROCYCLE_TEMPLATES } from '@/domain/config';
import type { TrainingType } from '@/domain/types';

/** Todas las combinaciones de `k` días entre los 7 de la semana. */
function combinaciones(k: number): number[][] {
  const out: number[][] = [];
  const elegir = (inicio: number, actual: number[]) => {
    if (actual.length === k) {
      out.push([...actual]);
      return;
    }
    for (let d = inicio; d < 7; d++) elegir(d + 1, [...actual, d]);
  };
  elegir(0, []);
  return out;
}

describe('validarDiasDisponibles', () => {
  it('rechaza menos del mínimo de la Tabla 4', () => {
    const r = validarDiasDisponibles([0, 2]);
    expect(r.valido).toBe(false);
    expect(r.mensaje).toContain('al menos 3');
  });

  it('rechaza los siete días: R4 exige un descanso absoluto', () => {
    const r = validarDiasDisponibles([0, 1, 2, 3, 4, 5, 6]);
    expect(r.valido).toBe(false);
    expect(r.mensaje).toContain('Descanso absoluto');
  });

  it('rechaza días repetidos y fuera de rango', () => {
    expect(validarDiasDisponibles([0, 0, 3, 5]).valido).toBe(false);
    expect(validarDiasDisponibles([0, 3, 9]).valido).toBe(false);
  });

  it('acepta una selección normal', () => {
    expect(validarDiasDisponibles([0, 2, 4, 6]).valido).toBe(true);
  });
});

describe('normalizarDiasDisponibles', () => {
  it('ordena, deduplica y descarta lo que no es un día', () => {
    expect(normalizarDiasDisponibles([6, 2, 2, 0, -1, 9])).toEqual([0, 2, 6]);
  });

  it('recorta al techo entrenable', () => {
    expect(normalizarDiasDisponibles([0, 1, 2, 3, 4, 5, 6])).toHaveLength(MAX_DIAS_ENTRENAMIENTO);
  });
});

describe('sesionesDePlantilla', () => {
  it('devuelve tantas sesiones como días, sin descansos', () => {
    for (let n = MIN_DIAS_ENTRENAMIENTO; n <= MAX_DIAS_ENTRENAMIENTO; n++) {
      const sesiones = sesionesDePlantilla(n);
      expect(sesiones).toHaveLength(n);
      expect(sesiones).not.toContain('D');
    }
  });

  it('conserva la composición de la Tabla 4 (una F por semana)', () => {
    for (let n = MIN_DIAS_ENTRENAMIENTO; n <= MAX_DIAS_ENTRENAMIENTO; n++) {
      expect(sesionesDePlantilla(n).filter((t) => t === 'F')).toHaveLength(1);
    }
  });
});

describe('acomodarSesionesEnDias', () => {
  it('pone las sesiones exactamente en los días elegidos', () => {
    const semana = acomodarSesionesEnDias(['E', 'E', 'R', 'F'], [0, 2, 4, 6]);
    expect(semana).not.toBeNull();

    semana!.forEach((tipo, i) => {
      const esDiaElegido = [0, 2, 4, 6].includes(i);
      if (esDiaElegido) expect(tipo).not.toBe('D');
      else expect(tipo).toBe('D');
    });
  });

  it('no devuelve nunca una semana que viole R1-R4', () => {
    // Todas las selecciones legales posibles, en todos los tamaños.
    for (let k = MIN_DIAS_ENTRENAMIENTO; k <= MAX_DIAS_ENTRENAMIENTO; k++) {
      for (const dias of combinaciones(k)) {
        const semana = acomodarSesionesEnDias(sesionesDePlantilla(k), dias);
        if (semana === null) continue;
        expect(validarSecuencia(semana).valid).toBe(true);
      }
    }
  });

  it('conserva la carga: la misma cantidad de cada tipo que la plantilla', () => {
    for (let k = MIN_DIAS_ENTRENAMIENTO; k <= MAX_DIAS_ENTRENAMIENTO; k++) {
      for (const dias of combinaciones(k)) {
        const sesiones = sesionesDePlantilla(k);
        const semana = acomodarSesionesEnDias(sesiones, dias);
        if (semana === null) continue;

        const contar = (arr: readonly TrainingType[], t: TrainingType) =>
          arr.filter((x) => x === t).length;
        for (const tipo of ['E', 'F', 'R'] as const) {
          expect(contar(semana, tipo)).toBe(contar(sesiones, tipo));
        }
      }
    }
  });

  it('es determinista', () => {
    const a = acomodarSesionesEnDias(['E', 'E', 'R', 'F'], [1, 3, 5, 6]);
    const b = acomodarSesionesEnDias(['E', 'E', 'R', 'F'], [1, 3, 5, 6]);
    expect(a).toEqual(b);
  });

  it('devuelve null si hay más sesiones que días', () => {
    expect(acomodarSesionesEnDias(['E', 'E', 'R', 'F'], [0, 2])).toBeNull();
  });

  it('deja en Descanso los días elegidos que sobran', () => {
    const semana = acomodarSesionesEnDias(['E', 'F'], [0, 2, 4, 6]);
    expect(semana).not.toBeNull();
    expect(semana!.filter((t) => t !== 'D')).toHaveLength(2);
  });
});

describe('plantillaParaDias', () => {
  it('resuelve todas las selecciones legales respetando los días', () => {
    for (let k = MIN_DIAS_ENTRENAMIENTO; k <= MAX_DIAS_ENTRENAMIENTO; k++) {
      for (const dias of combinaciones(k)) {
        const { plantilla, respetaDiasElegidos } = plantillaParaDias(dias);
        expect(plantilla).toHaveLength(7);

        if (respetaDiasElegidos) {
          // Ninguna sesión cayó fuera de los días que la persona eligió.
          plantilla.forEach((tipo, i) => {
            if (!dias.includes(i)) expect(tipo).toBe('D');
          });
        }
      }
    }
  });
});

describe('generarMacrociclo con días elegidos', () => {
  const base = {
    distance: '10K' as const,
    targetSeconds: 50 * 60,
    raceDate: '2026-06-01',
    startDate: '2026-01-05',
    volumenActualKm: 20,
    ritmoBase: 'promedio' as const,
  };

  it('usa la cantidad de días elegidos, no la de la Tabla 3', () => {
    const plan = generarMacrociclo({ ...base, diasDisponibles: [0, 2, 4] });
    for (const meso of plan.mesocycles) {
      for (const week of meso.weeks) {
        expect(week.days.filter((d) => d.type !== 'D')).toHaveLength(3);
      }
    }
  });

  it('todas las sesiones caen en los días elegidos', () => {
    const dias = [1, 3, 5, 6];
    const plan = generarMacrociclo({ ...base, diasDisponibles: dias });

    for (const meso of plan.mesocycles) {
      for (const week of meso.weeks) {
        for (const day of week.days) {
          if (day.type !== 'D') expect(dias).toContain(day.dayIndex);
        }
      }
    }
  });

  it('toda semana generada sigue respetando R1-R4', () => {
    for (const dias of [
      [0, 2, 4],
      [1, 3, 5],
      [0, 1, 3, 5],
      [0, 2, 4, 5, 6],
      [0, 1, 2, 3, 4, 5],
    ]) {
      const plan = generarMacrociclo({ ...base, diasDisponibles: dias });
      for (const meso of plan.mesocycles) {
        for (const week of meso.weeks) {
          expect(validarSecuencia(week.days.map((d) => d.type)).valid).toBe(true);
        }
      }
    }
  });

  it('avisa cuando se entrena menos días de los que recomienda la Tabla 3', () => {
    // Objetivo exigente (sub-40 en 10K) con sólo tres días disponibles.
    const plan = generarMacrociclo({
      ...base,
      targetSeconds: 38 * 60,
      diasDisponibles: [0, 2, 4],
    });
    expect(plan.warnings.some((w) => w.includes('Tabla 3'))).toBe(true);
  });

  it('sin días elegidos sigue usando la plantilla de la Tabla 4', () => {
    const plan = generarMacrociclo({ ...base, diasPorSemana: 4 });
    const primera = plan.mesocycles[0]!.weeks[0]!;

    // La plantilla de 4 días es D E D E D R F: sin días elegidos, el plan tiene
    // que seguir cayendo exactamente ahí.
    expect(primera.days.map((d) => d.type)).toEqual(MICROCYCLE_TEMPLATES[4]);
    expect(plan.warnings.some((w) => w.includes('Tabla 3'))).toBe(false);
  });
});
