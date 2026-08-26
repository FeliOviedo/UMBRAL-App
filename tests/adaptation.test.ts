import { describe, expect, it } from 'vitest';
import {
  adaptarPorBuenaAdaptacion,
  adaptarPorCargaExterna,
  adaptarPorCierreDeMesociclo,
  adaptarPorFeedbackPobre,
  adaptarPorSesionOmitida,
  redactarConPlantilla,
} from '@/domain/adaptation';
import { validarMicrociclo } from '@/domain/rules';
import type { PlannedDay, TrainingType } from '@/domain/types';

const dias = (types: readonly TrainingType[]): PlannedDay[] =>
  types.map((type, dayIndex) => ({
    dayIndex,
    type,
    discipline: 'running' as const,
    km: type === 'D' ? 0 : type === 'F' ? 18 : type === 'E' ? 12 : 8,
    ...(type === 'D'
      ? {}
      : { targetZone: type === 'F' ? ('Z2' as const) : type === 'E' ? ('Z4' as const) : ('Z1' as const) }),
    ...(type === 'D' ? {} : { targetRpe: type === 'F' ? 4 : type === 'E' ? 7 : 2 }),
  }));

// La semana estándar de 4 días: D E D E D R F.
const SEMANA = dias(['D', 'E', 'D', 'E', 'D', 'R', 'F']);

/**
 * El invariante que sostiene todo el motor: ninguna propuesta puede violar
 * R1-R4. Se aplica a cada caso, no una vez.
 */
function esperarSemanaLegal(propuesta: PlannedDay[] | null) {
  if (propuesta === null) return;
  const resultado = validarMicrociclo(propuesta);
  expect(resultado.violations).toEqual([]);
  expect(resultado.valid).toBe(true);
}

describe('invariantes del motor', () => {
  it('toda adaptación viene con título y explicación en español', () => {
    const casos = [
      adaptarPorSesionOmitida(SEMANA, 1),
      adaptarPorCargaExterna(SEMANA, {
        diaActividad: 2,
        cargaMetabolica: 300,
        nombreActividad: 'fútbol',
      }),
      adaptarPorFeedbackPobre(SEMANA, { diaSesion: 1, rpeReal: 9, rpePlanificado: 7 }),
      adaptarPorBuenaAdaptacion({ deltaRpe: -1.5, deltaFc: -6, enCicloDeBase: true }),
      adaptarPorCierreDeMesociclo({ mesociclo: 1, diasDesdeUltimoTest: 28 }),
    ];

    for (const adaptacion of casos) {
      expect(adaptacion.titulo.length).toBeGreaterThan(0);
      expect(adaptacion.explicacion.length).toBeGreaterThan(40);
      // Nada de jerga interna filtrándose al texto del usuario.
      expect(adaptacion.explicacion).not.toMatch(/undefined|null|NaN|\[object/);
    }
  });

  it('ninguna propuesta viola las reglas del microciclo', () => {
    esperarSemanaLegal(adaptarPorSesionOmitida(SEMANA, 1).semanaPropuesta);
    esperarSemanaLegal(adaptarPorSesionOmitida(SEMANA, 6).semanaPropuesta);
    esperarSemanaLegal(
      adaptarPorCargaExterna(SEMANA, {
        diaActividad: 0,
        cargaMetabolica: 300,
        nombreActividad: 'fútbol',
      }).semanaPropuesta,
    );
    esperarSemanaLegal(
      adaptarPorFeedbackPobre(SEMANA, { diaSesion: 1, rpeReal: 9, rpePlanificado: 7 })
        .semanaPropuesta,
    );
  });

  it('es determinista', () => {
    const a = adaptarPorSesionOmitida(SEMANA, 1);
    const b = adaptarPorSesionOmitida(SEMANA, 1);
    expect(a).toEqual(b);
  });
});

describe('caso 1 — sesión omitida', () => {
  it('reordena respetando R1-R4 y conserva la cantidad de sesiones', () => {
    const resultado = adaptarPorSesionOmitida(SEMANA, 3); // se saltea un E
    expect(resultado.motivo).toBe('sesion-omitida');
    expect(resultado.aplicable).toBe(true);
    expect(resultado.semanaPropuesta).toHaveLength(6);
    esperarSemanaLegal(resultado.semanaPropuesta);
  });

  it('nunca deja dos Específicos seguidos al reordenar', () => {
    // Semana con tres E: el reordenamiento tiene que separarlos igual.
    const apretada = dias(['E', 'R', 'E', 'R', 'E', 'D', 'F']);
    const resultado = adaptarPorSesionOmitida(apretada, 5); // se saltea el D
    if (resultado.semanaPropuesta) {
      const tipos = resultado.semanaPropuesta.map((d) => d.type);
      for (let i = 1; i < tipos.length; i++) {
        expect(tipos[i - 1] === 'E' && tipos[i] === 'E').toBe(false);
      }
    }
  });

  it('nunca deja un Específico justo después del largo', () => {
    const resultado = adaptarPorSesionOmitida(SEMANA, 2);
    const tipos = resultado.semanaPropuesta!.map((d) => d.type);
    for (let i = 1; i < tipos.length; i++) {
      expect(tipos[i - 1] === 'F' && tipos[i] === 'E').toBe(false);
    }
  });

  it('nombra la sesión que se salteó en la explicación', () => {
    const resultado = adaptarPorSesionOmitida(SEMANA, 6); // el largo
    expect(resultado.explicacion.toLowerCase()).toContain('largo');
  });

  it('reindexa los días desde 0', () => {
    const resultado = adaptarPorSesionOmitida(SEMANA, 1);
    expect(resultado.semanaPropuesta!.map((d) => d.dayIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('avisa sin tocar el plan cuando no hay reordenamiento legal', () => {
    // Cuatro E y un solo comodín: imposible de separar.
    const imposible = dias(['E', 'E', 'E', 'E', 'D']);
    const resultado = adaptarPorSesionOmitida(imposible, 4); // se saltea el único D
    expect(resultado.aplicable).toBe(false);
    expect(resultado.semanaPropuesta).toBeNull();
    expect(resultado.accion).toBe('ninguna');
  });
});

describe('caso 2 — carga externa', () => {
  it('una carga liviana no toca el plan', () => {
    const resultado = adaptarPorCargaExterna(SEMANA, {
      diaActividad: 0,
      cargaMetabolica: 100,
      nombreActividad: 'una caminata',
    });
    expect(resultado.accion).toBe('ninguna');
    expect(resultado.semanaPropuesta).toBeNull();
  });

  it('una carga alta degrada el Específico del día siguiente a Recuperación', () => {
    const resultado = adaptarPorCargaExterna(SEMANA, {
      diaActividad: 0,
      cargaMetabolica: 300,
      nombreActividad: 'fútbol',
    });

    expect(resultado.accion).toBe('degradar-sesion');
    expect(resultado.diasModificados).toEqual([1]);

    const degradado = resultado.semanaPropuesta!.find((d) => d.dayIndex === 1)!;
    expect(degradado.type).toBe('R');
    expect(degradado.targetZone).toBe('Z1');
    expect(degradado.targetRpe).toBe(2);
    // Se conserva parte del volumen: no se anula el día.
    expect(degradado.km).toBeGreaterThan(0);
    expect(degradado.km).toBeLessThan(12);
  });

  it('una carga muy alta mira dos días hacia adelante', () => {
    // El E cae dos días después de la actividad.
    const semana = dias(['D', 'D', 'E', 'D', 'R', 'D', 'F']);
    const resultado = adaptarPorCargaExterna(semana, {
      diaActividad: 0,
      cargaMetabolica: 500,
      nombreActividad: 'un partido largo',
    });
    expect(resultado.accion).toBe('degradar-sesion');
    expect(resultado.diasModificados).toEqual([2]);
  });

  it('no toca nada si no hay sesión exigente en la ventana', () => {
    const resultado = adaptarPorCargaExterna(SEMANA, {
      diaActividad: 4, // al día siguiente hay R
      cargaMetabolica: 300,
      nombreActividad: 'gimnasio',
    });
    expect(resultado.accion).toBe('ninguna');
  });

  it('degrada una sola sesión aunque haya dos en la ventana', () => {
    const semana = dias(['D', 'E', 'F', 'R', 'D', 'R', 'D']);
    const resultado = adaptarPorCargaExterna(semana, {
      diaActividad: 0,
      cargaMetabolica: 500,
      nombreActividad: 'fútbol',
    });
    expect(resultado.diasModificados).toHaveLength(1);
  });

  it('nombra la actividad en la explicación', () => {
    const resultado = adaptarPorCargaExterna(SEMANA, {
      diaActividad: 0,
      cargaMetabolica: 300,
      nombreActividad: 'fútbol',
    });
    expect(resultado.explicacion).toContain('fútbol');
  });
});

describe('caso 3 — feedback pobre', () => {
  it('no hace nada si el RPE estuvo dentro de lo esperado', () => {
    const resultado = adaptarPorFeedbackPobre(SEMANA, {
      diaSesion: 1,
      rpeReal: 8,
      rpePlanificado: 7,
    });
    expect(resultado.accion).toBe('ninguna');
    expect(resultado.semanaPropuesta).toBeNull();
  });

  it('inserta recuperación antes del próximo Específico si el RPE se disparó', () => {
    // Día 1 es E; el próximo E es el día 3, y el día 2 es D…
    // Usamos una semana donde el día previo al próximo E sea exigente.
    const semana = dias(['D', 'E', 'F', 'E', 'D', 'R', 'D']);
    const resultado = adaptarPorFeedbackPobre(semana, {
      diaSesion: 1,
      rpeReal: 9,
      rpePlanificado: 7,
    });

    expect(resultado.accion).toBe('insertar-recuperacion');
    expect(resultado.diasModificados).toEqual([2]);
    const modificado = resultado.semanaPropuesta!.find((d) => d.dayIndex === 2)!;
    expect(modificado.type).toBe('R');
    esperarSemanaLegal(resultado.semanaPropuesta);
  });

  it('no toca nada si antes del próximo Específico ya hay un día suave', () => {
    const resultado = adaptarPorFeedbackPobre(SEMANA, {
      diaSesion: 1,
      rpeReal: 10,
      rpePlanificado: 7,
    });
    // En D E D E D R F, antes del E del día 3 hay un D.
    expect(resultado.accion).toBe('ninguna');
  });

  it('la sensación refuerza pero no dispara sola', () => {
    const soloSensacion = adaptarPorFeedbackPobre(SEMANA, {
      diaSesion: 1,
      rpeReal: 7,
      rpePlanificado: 7,
      sensacion: 1,
    });
    expect(soloSensacion.accion).toBe('ninguna');

    const conAmbas = adaptarPorFeedbackPobre(SEMANA, {
      diaSesion: 1,
      rpeReal: 10,
      rpePlanificado: 7,
      sensacion: 1,
    });
    expect(conAmbas.explicacion).toMatch(/sentiste mal/);
  });

  it('avisa sin tocar nada si no queda ningún Específico', () => {
    const resultado = adaptarPorFeedbackPobre(SEMANA, {
      diaSesion: 5,
      rpeReal: 9,
      rpePlanificado: 4,
    });
    expect(resultado.accion).toBe('ninguna');
    expect(resultado.explicacion).toMatch(/Específico/);
  });
});

describe('caso 4 — buena adaptación', () => {
  it('confirma el progreso sin tocar el plan', () => {
    const resultado = adaptarPorBuenaAdaptacion({
      deltaRpe: -1.5,
      deltaFc: -6,
      enCicloDeBase: true,
    });
    expect(resultado.accion).toBe('ninguna');
    expect(resultado.semanaPropuesta).toBeNull();
    expect(resultado.titulo).toMatch(/progres/i);
  });

  it('menciona la FC sólo cuando confirma de verdad', () => {
    const conFc = adaptarPorBuenaAdaptacion({
      deltaRpe: -1.5,
      deltaFc: -8,
      enCicloDeBase: true,
    });
    expect(conFc.explicacion).toMatch(/frecuencia cardíaca/);

    const sinFc = adaptarPorBuenaAdaptacion({
      deltaRpe: -1.5,
      deltaFc: -1,
      enCicloDeBase: true,
    });
    expect(sinFc.explicacion).not.toMatch(/frecuencia cardíaca/);
  });

  it('fuera del ciclo de base advierte contra adelantar la progresión', () => {
    const resultado = adaptarPorBuenaAdaptacion({
      deltaRpe: -2,
      deltaFc: null,
      enCicloDeBase: false,
    });
    expect(resultado.explicacion).toMatch(/lesionarse|progresión/);
  });
});

describe('caso 5 — cierre de mesociclo', () => {
  it('pide re-test y dice cuántas semanas pasaron', () => {
    const resultado = adaptarPorCierreDeMesociclo({ mesociclo: 2, diasDesdeUltimoTest: 28 });
    expect(resultado.motivo).toBe('retest-mesociclo');
    expect(resultado.explicacion).toContain('4 semanas');
    expect(resultado.explicacion).toContain('mesociclo 2');
  });
});

describe('redacción', () => {
  it('la plantilla devuelve la explicación tal cual', async () => {
    const adaptacion = adaptarPorSesionOmitida(SEMANA, 1);
    expect(await redactarConPlantilla(adaptacion)).toBe(adaptacion.explicacion);
  });
});
