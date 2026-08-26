import { describe, expect, it } from 'vitest';
import { MICROCYCLE_TEMPLATES } from '@/domain/config';
import {
  explicarValidacion,
  repararMicrociclo,
  reordenarPorSesionOmitida,
  validarMicrociclo,
  validarSecuencia,
} from '@/domain/rules';
import type { PlannedDay, TrainingType } from '@/domain/types';

const dias = (types: readonly TrainingType[]): PlannedDay[] =>
  types.map((type, dayIndex) => ({
    dayIndex,
    type,
    discipline: 'running' as const,
    km: type === 'D' ? 0 : 5,
  }));

describe('R1 — después de F sólo R o D', () => {
  it('rechaza F seguido de E', () => {
    const result = validarSecuencia(['D', 'F', 'E', 'R', 'D', 'D', 'R']);
    expect(result.valid).toBe(false);
    expect(result.violations[0]!.rule).toBe('R1');
    expect(result.violations[0]!.dayIndex).toBe(2);
  });

  it('acepta F seguido de R o de D', () => {
    expect(validarSecuencia(['F', 'R', 'E', 'D', 'R', 'D', 'R']).valid).toBe(true);
    expect(validarSecuencia(['F', 'D', 'E', 'D', 'R', 'D', 'R']).valid).toBe(true);
  });

  it('acepta E seguido de F: la regla es en un solo sentido', () => {
    expect(validarSecuencia(['E', 'F', 'D', 'R', 'D', 'R', 'D']).valid).toBe(true);
  });
});

describe('R2 — nunca dos E consecutivos', () => {
  it('rechaza E seguido de E', () => {
    const result = validarSecuencia(['D', 'E', 'E', 'R', 'D', 'F', 'R']);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.rule === 'R2')).toBe(true);
  });

  it('acepta E separados por R o por D', () => {
    expect(validarSecuencia(['E', 'R', 'E', 'D', 'F', 'R', 'D']).valid).toBe(true);
    expect(validarSecuencia(['E', 'D', 'E', 'R', 'F', 'R', 'D']).valid).toBe(true);
  });

  it('detecta las tres violaciones de una racha de cuatro E', () => {
    const result = validarSecuencia(['E', 'E', 'E', 'E', 'D', 'R', 'F']);
    expect(result.violations.filter((v) => v.rule === 'R2')).toHaveLength(3);
  });
});

describe('R4 — al menos un D por semana', () => {
  it('rechaza una semana sin ningún descanso pasivo', () => {
    const result = validarSecuencia(['E', 'R', 'E', 'R', 'F', 'R', 'R']);
    expect(result.valid).toBe(false);
    expect(result.violations[0]!.rule).toBe('R4');
    expect(result.violations[0]!.dayIndex).toBe(-1);
  });

  it('no alcanza con días de recuperación activa', () => {
    expect(validarSecuencia(['R', 'R', 'R', 'R', 'R', 'R', 'R']).valid).toBe(false);
  });
});

describe('las plantillas de la Tabla 4 son válidas', () => {
  it.each([3, 4, 5])('la plantilla de %i días respeta R1-R4 tal cual viene', (dias) => {
    const template = MICROCYCLE_TEMPLATES[dias]!;
    expect(template).toHaveLength(7);
    expect(validarSecuencia(template).valid).toBe(true);
  });

  it('la plantilla de 6 días viola R2 tal como la da la tabla', () => {
    // 'R E R E E D F': dos Específicos pegados. Se conserva fiel a la fuente y
    // el generador la repara antes de usarla.
    const template = MICROCYCLE_TEMPLATES[6]!;
    const result = validarSecuencia(template);
    expect(result.valid).toBe(false);
    expect(result.violations.map((v) => v.rule)).toEqual(['R2']);
  });

  it('la plantilla de 6 días queda válida después de repararla', () => {
    const original = dias(MICROCYCLE_TEMPLATES[6]!);
    const reparada = repararMicrociclo(original);
    expect(validarMicrociclo(reparada).valid).toBe(true);
    expect(contar(reparada)).toEqual(contar(original));
  });

  it('cada plantilla tiene la cantidad de días de entrenamiento que promete', () => {
    for (const [dias, template] of Object.entries(MICROCYCLE_TEMPLATES)) {
      const entrenamientos = template.filter((t) => t !== 'D').length;
      // Los R cuentan como día de entrenamiento (recuperación activa).
      expect(entrenamientos).toBeGreaterThanOrEqual(Number(dias) - 1);
      expect(entrenamientos).toBeLessThanOrEqual(Number(dias));
    }
  });
});

describe('reparación de la semana (R3 — los R son comodines)', () => {
  it('repara una semana con dos E seguidos sin cambiar la carga', () => {
    const original = dias(['E', 'E', 'R', 'D', 'F', 'R', 'D']);
    const reparada = repararMicrociclo(original);

    expect(validarMicrociclo(reparada).valid).toBe(true);
    expect(contar(reparada)).toEqual(contar(original));
    expect(reparada.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('repara una semana con F seguido de E', () => {
    const reparada = repararMicrociclo(dias(['F', 'E', 'R', 'D', 'E', 'R', 'D']));
    expect(validarMicrociclo(reparada).valid).toBe(true);
  });

  it('conserva los km y las notas de cada sesión al reordenar', () => {
    const original = dias(['E', 'E', 'R', 'D', 'F', 'R', 'D']);
    original[4]!.km = 18;
    original[4]!.notes = 'Largo del domingo';

    const largo = repararMicrociclo(original).find((d) => d.type === 'F')!;
    expect(largo.km).toBe(18);
    expect(largo.notes).toBe('Largo del domingo');
  });

  it('deja una semana ya válida con la misma composición', () => {
    const original = dias(['D', 'E', 'D', 'E', 'D', 'R', 'F']);
    expect(contar(repararMicrociclo(original))).toEqual(contar(original));
  });

  it('devuelve el mejor esfuerzo, todavía inválido, si la semana es irreparable', () => {
    // Cuatro E y un solo comodín: no hay forma de separarlos todos.
    const imposible = dias(['E', 'E', 'E', 'E', 'D']);
    const reparada = repararMicrociclo(imposible);
    expect(contar(reparada)).toEqual(contar(imposible));
    expect(validarMicrociclo(reparada).valid).toBe(false);
  });
});

describe('sesión omitida (caso 1 del motor de adaptación)', () => {
  it('saca el día omitido y reordena el resto respetando las reglas', () => {
    const semana = dias(['D', 'E', 'D', 'E', 'D', 'R', 'F']);
    const reordenada = reordenarPorSesionOmitida(semana, 5); // se saltea el R

    expect(reordenada).toHaveLength(6);
    expect(reordenada.some((d) => d.type === 'R')).toBe(false);
    expect(validarMicrociclo(reordenada).valid).toBe(true);
  });

  it('reindexa los días desde 0 y sin huecos', () => {
    const reordenada = reordenarPorSesionOmitida(dias(['D', 'E', 'D', 'E', 'D', 'R', 'F']), 1);
    expect(reordenada.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('explicación en lenguaje natural', () => {
  it('confirma cuando la semana es válida', () => {
    const result = validarSecuencia(['D', 'E', 'D', 'E', 'D', 'R', 'F']);
    expect(explicarValidacion(result)).toMatch(/respeta las cuatro reglas/);
  });

  it('nombra la regla violada', () => {
    const result = validarSecuencia(['F', 'E', 'D', 'R', 'D', 'R', 'D']);
    expect(explicarValidacion(result)).toMatch(/^R1:/);
  });
});

function contar(days: readonly PlannedDay[]): Record<TrainingType, number> {
  const counts: Record<TrainingType, number> = { F: 0, E: 0, R: 0, D: 0 };
  for (const d of days) counts[d.type] += 1;
  return counts;
}
