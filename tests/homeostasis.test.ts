import { describe, expect, it } from 'vitest';
import {
  calcularHomeostasis,
  diasDeRecuperacionQuePide,
  explicarEstado,
  type CargaPuntual,
} from '@/domain/homeostasis';
import { HOMEOSTASIS_CONFIG } from '@/domain/config';
import {
  cajaNegra,
  cargaEnVentana,
  estadoSupercompensacion,
  serieDeBalance,
  type SesionAnalizable,
} from '@/domain/analysis';

describe('modelo de homeostasis', () => {
  it('sin cargas, todo en cero', () => {
    const h = calcularHomeostasis([]);
    expect(h.fatiga).toBe(0);
    expect(h.forma).toBe(0);
    expect(h.balance).toBe(0);
  });

  it('una sesión de ayer deja más fatiga que forma', () => {
    const h = calcularHomeostasis([{ diasAtras: 1, carga: 300 }]);
    expect(h.fatiga).toBeGreaterThan(h.forma);
    expect(h.balance).toBeLessThan(0);
  });

  it('la fatiga decae más rápido que la forma', () => {
    const reciente = calcularHomeostasis([{ diasAtras: 1, carga: 300 }]);
    const vieja = calcularHomeostasis([{ diasAtras: 21, carga: 300 }]);

    // A las 3 semanas la fatiga casi se fue y queda forma: eso es
    // supercompensación.
    expect(vieja.fatiga).toBeLessThan(reciente.fatiga * 0.2);
    expect(vieja.balance).toBeGreaterThan(reciente.balance);
    expect(vieja.balance).toBeGreaterThan(0);
  });

  it('ignora las cargas más viejas que la ventana', () => {
    const dentro = calcularHomeostasis([
      { diasAtras: HOMEOSTASIS_CONFIG.ventanaDias - 1, carga: 500 },
    ]);
    const fuera = calcularHomeostasis([
      { diasAtras: HOMEOSTASIS_CONFIG.ventanaDias + 1, carga: 500 },
    ]);
    expect(fuera.balance).toBe(0);
    expect(dentro.balance).not.toBe(0);
  });

  it('ignora cargas negativas o de días futuros', () => {
    const h = calcularHomeostasis([
      { diasAtras: -1, carga: 300 },
      { diasAtras: 2, carga: -50 },
    ]);
    expect(h.balance).toBe(0);
  });

  it('el balance normalizado no depende del volumen absoluto', () => {
    // Dos corredores con el mismo patrón pero distinto volumen tienen que dar
    // estados parecidos: uno corre el doble que el otro, no está el doble de
    // fatigado.
    const patron = (factor: number): CargaPuntual[] =>
      Array.from({ length: 12 }, (_, i) => ({ diasAtras: i * 2 + 1, carga: 200 * factor }));

    const chico = calcularHomeostasis(patron(1));
    const grande = calcularHomeostasis(patron(3));

    expect(grande.balance).toBeGreaterThan(chico.balance); // en absoluto, sí difiere
    expect(grande.balanceNormalizado).toBeCloseTo(chico.balanceNormalizado, 6);
    expect(grande.estado).toBe(chico.estado);
  });

  it('entrenar de forma sostenida da "listo", no "sobre-descansado"', () => {
    // Éste es el caso que rompía el modelo anterior: nueve semanas de plan
    // parejo salían clasificadas como si la persona hubiera dejado de correr.
    const sostenido = Array.from({ length: 24 }, (_, i) => ({
      diasAtras: i * 2 + 1,
      carga: 250,
    }));
    const h = calcularHomeostasis(sostenido);

    expect(h.ratioRelativo).toBeCloseTo(1, 1);
    expect(h.estado).toBe('listo');
  });

  it('clasifica los cuatro estados', () => {
    // Machaque reciente sobre una base normal → fatigado.
    const machacado = calcularHomeostasis([
      ...Array.from({ length: 18 }, (_, i) => ({ diasAtras: i * 2 + 8, carga: 200 })),
      ...Array.from({ length: 6 }, (_, i) => ({ diasAtras: i, carga: 500 })),
    ]);
    expect(machacado.estado).toBe('fatigado');

    // Base sostenida y una semana suave encima → la fatiga se fue, la forma quedó.
    const enPico = calcularHomeostasis(
      Array.from({ length: 18 }, (_, i) => ({ diasAtras: i * 2 + 8, carga: 300 })).concat([
        { diasAtras: 3, carga: 80 },
        { diasAtras: 6, carga: 80 },
      ]),
    );
    expect(enPico.estado).toBe('pico');

    // Cargas viejas y nada en las últimas dos semanas → dejó de entrenar.
    const parado = calcularHomeostasis(
      Array.from({ length: 6 }, (_, i) => ({ diasAtras: 25 + i, carga: 400 })),
    );
    expect(parado.estado).toBe('sobre-descansado');

    // Sin historia suficiente tampoco hay nada que sostener.
    expect(calcularHomeostasis([]).estado).toBe('sobre-descansado');
  });

  it('cada estado tiene su explicación', () => {
    for (const estado of ['fatigado', 'listo', 'pico', 'sobre-descansado'] as const) {
      const { titulo, detalle } = explicarEstado(estado);
      expect(titulo.length).toBeGreaterThan(0);
      expect(detalle.length).toBeGreaterThan(50);
    }
  });
});

describe('días de recuperación que pide una carga externa', () => {
  it.each([
    [50, 0],
    [199, 0],
    [200, 1],
    [399, 1],
    [400, 2],
    [900, 2],
  ])('carga %i → %i días', (carga, esperado) => {
    expect(diasDeRecuperacionQuePide(carga)).toBe(esperado);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

const sesion = (
  diasAtras: number,
  pace: number | null,
  rpe: number,
  fc: number | null = null,
  carga = 200,
): SesionAnalizable => ({
  diasAtras,
  paceSecPerKm: pace,
  rpe,
  fcPromedio: fc,
  cargaMetabolica: carga,
});

describe('caja negra', () => {
  it('avisa cuando no hay datos suficientes', () => {
    const resultado = cajaNegra([sesion(1, 360, 4)], 360);
    expect(resultado.veredicto).toBe('sin-datos');
    expect(resultado.mensaje).toMatch(/suficientes/);
  });

  it('detecta progreso: mismo pace, menos esfuerzo', () => {
    const sesiones = [
      sesion(35, 360, 6),
      sesion(30, 360, 6),
      sesion(5, 360, 4),
      sesion(2, 360, 4),
    ];
    const resultado = cajaNegra(sesiones, 360);

    expect(resultado.veredicto).toBe('progreso');
    expect(resultado.deltaRpe).toBeLessThan(0);
    expect(resultado.mensaje).toMatch(/cuesta menos|bajó/i);
  });

  it('detecta retroceso', () => {
    const sesiones = [
      sesion(35, 360, 4),
      sesion(30, 360, 4),
      sesion(5, 360, 6),
      sesion(2, 360, 6),
    ];
    const resultado = cajaNegra(sesiones, 360);
    expect(resultado.veredicto).toBe('retroceso');
    expect(resultado.deltaRpe).toBeGreaterThan(0);
  });

  it('reporta estable cuando el esfuerzo se mantiene', () => {
    const sesiones = [
      sesion(35, 360, 5),
      sesion(30, 360, 5),
      sesion(5, 360, 5),
      sesion(2, 360, 5),
    ];
    expect(cajaNegra(sesiones, 360).veredicto).toBe('estable');
  });

  it('sólo compara sesiones al mismo pace', () => {
    const sesiones = [
      sesion(35, 360, 6),
      sesion(30, 360, 6),
      sesion(5, 240, 4), // mucho más rápida: no es comparable
      sesion(2, 240, 4),
    ];
    expect(cajaNegra(sesiones, 360).veredicto).toBe('sin-datos');
  });

  it('descarta los esfuerzos máximos: ahí el RPE lo fija la intención', () => {
    const sesiones = [
      sesion(35, 360, 4),
      sesion(30, 360, 4),
      sesion(5, 360, 10), // un test al límite al mismo pace
      sesion(2, 360, 9),
    ];
    // Las de RPE 9-10 quedan fuera, así que no alcanzan sesiones comparables.
    expect(cajaNegra(sesiones, 360).veredicto).toBe('sin-datos');
  });

  it('NO filtra por RPE: un corredor que pasa de RPE 6 a 4 tiene que verse', () => {
    // Filtrar por "sesiones fáciles" sesgaría la muestra en la variable que se
    // está midiendo y ocultaría justo el progreso que interesa.
    const sesiones = [
      sesion(35, 360, 7),
      sesion(30, 360, 6),
      sesion(5, 360, 4),
      sesion(2, 360, 4),
    ];
    expect(cajaNegra(sesiones, 360).veredicto).toBe('progreso');
    expect(cajaNegra(sesiones, 360).sesionesComparadas).toBe(4);
  });

  it('usa la FC sólo como apoyo, nunca como fuente única', () => {
    const conFcQueApoya = cajaNegra(
      [
        sesion(35, 360, 6, 160),
        sesion(30, 360, 6, 160),
        sesion(5, 360, 4, 150),
        sesion(2, 360, 4, 150),
      ],
      360,
    );
    expect(conFcQueApoya.deltaFc).toBe(-10);
    expect(conFcQueApoya.mensaje).toMatch(/frecuencia cardíaca/);

    // Si la FC contradice al RPE, el veredicto lo sigue marcando el RPE.
    const conFcQueContradice = cajaNegra(
      [
        sesion(35, 360, 6, 150),
        sesion(30, 360, 6, 150),
        sesion(5, 360, 4, 165),
        sesion(2, 360, 4, 165),
      ],
      360,
    );
    expect(conFcQueContradice.veredicto).toBe('progreso');
  });

  it('funciona sin FC en absoluto', () => {
    const resultado = cajaNegra(
      [sesion(35, 360, 6), sesion(30, 360, 6), sesion(5, 360, 4), sesion(2, 360, 4)],
      360,
    );
    expect(resultado.deltaFc).toBeNull();
    expect(resultado.veredicto).toBe('progreso');
  });

  it('tolera diferencias chicas de pace', () => {
    const resultado = cajaNegra(
      [sesion(35, 355, 6), sesion(30, 368, 6), sesion(5, 362, 4), sesion(2, 350, 4)],
      360,
    );
    expect(resultado.sesionesComparadas).toBe(4);
  });
});

describe('estado de supercompensación', () => {
  it('suma las complementarias como cualquier otra sesión', () => {
    // No hay parámetro aparte: la carga metabólica es unificada.
    const soloCorriendo = estadoSupercompensacion([sesion(1, 360, 5, null, 200)]);
    const conGimnasio = estadoSupercompensacion([
      sesion(1, 360, 5, null, 200),
      sesion(1, null, 7, null, 300), // una sesión de fuerza: sin pace
    ]);
    expect(conGimnasio.fatiga).toBeGreaterThan(soloCorriendo.fatiga);
  });
});

describe('carga en ventana', () => {
  it('suma sólo lo que cae dentro', () => {
    const sesiones = [sesion(1, 360, 5, null, 200), sesion(10, 360, 5, null, 300)];
    expect(cargaEnVentana(sesiones, 7)).toBe(200);
    expect(cargaEnVentana(sesiones, 14)).toBe(500);
  });
});

describe('serie de balance', () => {
  it('devuelve un punto por día, del más viejo a hoy', () => {
    const serie = serieDeBalance([sesion(5, 360, 5)], 10);
    expect(serie).toHaveLength(10);
    expect(serie[0]!.diasAtras).toBe(9);
    expect(serie[serie.length - 1]!.diasAtras).toBe(0);
  });

  it('el balance sube después de que la carga deja de acumularse', () => {
    // Una sola sesión hace 20 días: al principio fatiga, después forma.
    const serie = serieDeBalance([sesion(20, 360, 8, null, 400)], 25);
    const justoDespues = serie.find((p) => p.diasAtras === 19)!;
    const hoy = serie.find((p) => p.diasAtras === 0)!;
    expect(hoy.balanceNormalizado).toBeGreaterThan(justoDespues.balanceNormalizado);
  });
});
