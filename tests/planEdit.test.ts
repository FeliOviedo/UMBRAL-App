import { describe, expect, it } from 'vitest';
import {
  planearMovimiento,
  planearSaltoDeMesociclo,
  semanaDeLaFecha,
  type SemanaDelPlan,
  type SemanaMovible,
} from '@/domain/planEdit';
import type { TrainingType } from '@/domain/types';
import { sumarDias } from '@/lib/format';

/** Arma una semana movible a partir de sus siete tipos. */
function semana(id: string, fechaInicio: string, tipos: readonly TrainingType[]): SemanaMovible {
  return {
    id,
    fechaInicio,
    dias: tipos.map((tipo, diaIndex) => ({
      id: `${id}-d${diaIndex}`,
      semanaId: id,
      diaIndex,
      fecha: sumarDias(fechaInicio, diaIndex),
      tipo,
    })),
  };
}

// Semana estándar de 4 días: D E D E D R F, arrancando un lunes.
const LUNES = '2026-03-02';
const SEMANAS: SemanaMovible[] = [
  semana('s1', LUNES, ['D', 'E', 'D', 'E', 'D', 'R', 'F']),
  semana('s2', sumarDias(LUNES, 7), ['D', 'E', 'D', 'E', 'D', 'R', 'F']),
];

describe('semanaDeLaFecha', () => {
  it('encuentra la semana que contiene la fecha', () => {
    expect(semanaDeLaFecha(SEMANAS, sumarDias(LUNES, 3))?.id).toBe('s1');
    expect(semanaDeLaFecha(SEMANAS, sumarDias(LUNES, 8))?.id).toBe('s2');
  });

  it('devuelve null fuera del plan', () => {
    expect(semanaDeLaFecha(SEMANAS, sumarDias(LUNES, -1))).toBeNull();
    expect(semanaDeLaFecha(SEMANAS, sumarDias(LUNES, 14))).toBeNull();
  });
});

describe('planearMovimiento', () => {
  it('intercambia cuando el destino está ocupado', () => {
    // El E del martes (índice 1) al miércoles (índice 2), que es D.
    const r = planearMovimiento(SEMANAS, 's1-d1', sumarDias(LUNES, 2));

    expect(r).not.toBeNull();
    expect(r!.intercambio).toBe(true);
    expect(r!.movimientos).toHaveLength(2);

    const movido = r!.movimientos.find((m) => m.id === 's1-d1')!;
    expect(movido.diaIndex).toBe(2);
    expect(movido.fecha).toBe(sumarDias(LUNES, 2));

    // El descanso que estaba ahí se va al martes.
    const desplazado = r!.movimientos.find((m) => m.id === 's1-d2')!;
    expect(desplazado.diaIndex).toBe(1);
  });

  it('conserva la composición de la semana al intercambiar', () => {
    const r = planearMovimiento(SEMANAS, 's1-d6', sumarDias(LUNES, 0))!;
    // Dos movimientos que se cruzan: ningún día queda sin lugar ni duplicado.
    const indices = r.movimientos.map((m) => m.diaIndex).sort();
    expect(indices).toEqual([0, 6]);
  });

  it('detecta y explica cuando el movimiento rompe una regla', () => {
    // Mover el F del domingo al miércoles deja F(2) seguido de E(3): rompe R1.
    const r = planearMovimiento(SEMANAS, 's1-d6', sumarDias(LUNES, 2))!;

    expect(r.violaciones.length).toBeGreaterThan(0);
    expect(r.violaciones.some((v) => v.rule === 'R1')).toBe(true);
    expect(r.mensaje).toContain('R1');
  });

  it('confirma cuando el movimiento es legal', () => {
    // El R del sábado al lunes (D): no toca ninguna adyacencia dura.
    const r = planearMovimiento(SEMANAS, 's1-d5', sumarDias(LUNES, 0))!;
    expect(r.violaciones).toHaveLength(0);
    expect(r.mensaje).toContain('cuatro reglas');
  });

  it('permite mover a otra semana y marca las dos como afectadas', () => {
    const r = planearMovimiento(SEMANAS, 's1-d1', sumarDias(LUNES, 9))!;
    expect(r.semanasAfectadas.sort()).toEqual(['s1', 's2']);

    const movido = r.movimientos.find((m) => m.id === 's1-d1')!;
    expect(movido.semanaId).toBe('s2');
    expect(movido.diaIndex).toBe(2);
  });

  it('no hace nada si se suelta en el mismo día', () => {
    const r = planearMovimiento(SEMANAS, 's1-d1', sumarDias(LUNES, 1))!;
    expect(r.movimientos).toHaveLength(0);
    expect(r.mensaje).toContain('ya estaba');
  });

  it('devuelve null fuera del plan o con un día inexistente', () => {
    expect(planearMovimiento(SEMANAS, 's1-d1', sumarDias(LUNES, 30))).toBeNull();
    expect(planearMovimiento(SEMANAS, 'no-existe', sumarDias(LUNES, 2))).toBeNull();
  });

  it('valida la semana COMPLETA tras el movimiento, no sólo el día tocado', () => {
    // Dos E separados por un R (D E R E D D F). Al traer el segundo E sobre el
    // R, el intercambio los deja pegados: D E E R D D F, que rompe R2.
    // La violación aparece en una adyacencia que no involucra al día soltado,
    // así que sólo se detecta revalidando la semana entera.
    const conR = [semana('x', LUNES, ['D', 'E', 'R', 'E', 'D', 'D', 'F'])];
    const r = planearMovimiento(conR, 'x-d3', sumarDias(LUNES, 2))!;

    expect(r.intercambio).toBe(true);
    expect(r.violaciones.some((v) => v.rule === 'R2')).toBe(true);
  });
});

describe('planearSaltoDeMesociclo', () => {
  /** Plan de 8 semanas en dos mesociclos de 4. */
  const plan: SemanaDelPlan[] = Array.from({ length: 8 }, (_, i) => ({
    id: `w${i + 1}`,
    numero: i + 1,
    mesociclo: i < 4 ? 1 : 2,
    fechaInicio: sumarDias(LUNES, i * 7),
    dias: Array.from({ length: 7 }, (_, d) => ({ id: `w${i + 1}d${d}`, diaIndex: d })),
  }));

  // "Hoy" cae en la semana 2, así que las semanas 1 y 2 ya arrancaron.
  const HOY = sumarDias(LUNES, 9);

  it('saltea sólo las semanas del mesociclo que todavía no arrancaron', () => {
    const salto = planearSaltoDeMesociclo(plan, 1, HOY)!;
    // Del mesociclo 1 quedan por arrancar la 3 y la 4.
    expect(salto.semanasEliminadas.sort()).toEqual(['w3', 'w4']);
    expect(salto.semanasSalteadas).toBe(2);
  });

  it('adelanta el resto del plan sin dejar hueco', () => {
    const salto = planearSaltoDeMesociclo(plan, 1, HOY)!;

    // La semana 5 arrancaba 4 semanas después del lunes; al saltear 2, arranca 2.
    const w5 = salto.semanasRecalendarizadas.find((s) => s.id === 'w5')!;
    expect(w5.fechaInicio).toBe(sumarDias(LUNES, 2 * 7));

    // Todas las posteriores se corren lo mismo.
    const w8 = salto.semanasRecalendarizadas.find((s) => s.id === 'w8')!;
    expect(w8.fechaInicio).toBe(sumarDias(LUNES, 5 * 7));
  });

  it('recalendariza los días respetando su posición en la semana', () => {
    const salto = planearSaltoDeMesociclo(plan, 1, HOY)!;
    const miercolesDeLa5 = salto.diasRecalendarizados.find((d) => d.id === 'w5d2')!;
    expect(miercolesDeLa5.fecha).toBe(sumarDias(LUNES, 2 * 7 + 2));
  });

  it('no toca las semanas ya vividas', () => {
    const salto = planearSaltoDeMesociclo(plan, 1, HOY)!;
    const ids = [
      ...salto.semanasEliminadas,
      ...salto.semanasRecalendarizadas.map((s) => s.id),
    ];
    expect(ids).not.toContain('w1');
    expect(ids).not.toContain('w2');
  });

  it('devuelve null si el mesociclo ya pasó entero', () => {
    const despues = sumarDias(LUNES, 60);
    expect(planearSaltoDeMesociclo(plan, 1, despues)).toBeNull();
  });

  it('advierte que adelantar saltea carga acumulada', () => {
    const salto = planearSaltoDeMesociclo(plan, 1, HOY)!;
    expect(salto.mensaje).toContain('carga');
  });
});
