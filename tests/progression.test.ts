import { describe, expect, it } from 'vitest';
import { DELOAD_VOLUME_FACTOR, PROGRESSION_TABLE } from '@/domain/config';
import {
  aplicarProgresion,
  calcularIncrementoSemanal,
  filaDeProgresion,
  proyectarVolumen,
  rangoIncrementoSemanal,
  ritmoBasePorPace,
} from '@/domain/progression';
import { secuenciaDeCargas } from '@/domain/planner';

describe('Tabla 7 — estructura', () => {
  it('tiene las seis filas de ritmo', () => {
    expect(PROGRESSION_TABLE.map((r) => r.level)).toEqual([
      'suave',
      'promedio',
      'moderado',
      'fuerte',
      'rapido',
      'ultra',
    ]);
  });

  it('el pace declarado es del orden de la velocidad en km/h', () => {
    // La tabla redondea los paces a mano, así que km/h y pace no son
    // conversiones exactas (9 km/h serían 6:40, no 7:00). Se verifica el orden
    // de magnitud, que es lo que la tabla garantiza.
    for (const row of PROGRESSION_TABLE) {
      expect(Math.abs(row.paceSecPerKm - 3600 / row.kmh)).toBeLessThan(25);
    }
  });

  it('las dos columnas de referencia son monótonas y consistentes entre sí', () => {
    for (let i = 1; i < PROGRESSION_TABLE.length; i++) {
      expect(PROGRESSION_TABLE[i]!.kmh).toBeGreaterThan(PROGRESSION_TABLE[i - 1]!.kmh);
      expect(PROGRESSION_TABLE[i]!.paceSecPerKm).toBeLessThan(
        PROGRESSION_TABLE[i - 1]!.paceSecPerKm,
      );
    }
  });

  it('los rangos son crecientes y bien formados en las cuatro distancias', () => {
    for (const row of PROGRESSION_TABLE) {
      for (const [min, max] of Object.values(row.increments)) {
        expect(min).toBeLessThanOrEqual(max);
        expect(min).toBeGreaterThan(0);
      }
    }
  });

  it('a mayor distancia objetivo, el techo del incremento no baja', () => {
    for (const row of PROGRESSION_TABLE) {
      const { '5K': c5, '10K': c10, '21K': c21, '42K': c42 } = row.increments;
      expect(c10[1]).toBeGreaterThanOrEqual(c5[1]);
      expect(c21[1]).toBeGreaterThanOrEqual(c10[1]);
      expect(c42[1]).toBeGreaterThanOrEqual(c21[1]);
    }
  });

  it('a mayor ritmo base, mayor incremento semanal', () => {
    for (let i = 1; i < PROGRESSION_TABLE.length; i++) {
      expect(PROGRESSION_TABLE[i]!.increments['10K'][0]).toBeGreaterThan(
        PROGRESSION_TABLE[i - 1]!.increments['10K'][0],
      );
    }
  });
});

describe('ubicar el ritmo base por pace', () => {
  it.each([
    [420, 'suave'], // 7:00
    [360, 'promedio'], // 6:00
    [300, 'moderado'], // 5:00
    [276, 'fuerte'], // 4:36
    [240, 'rapido'], // 4:00
    [204, 'ultra'], // 3:24
  ])('%i s/km es ritmo %s', (pace, expected) => {
    expect(ritmoBasePorPace(pace)).toBe(expected);
  });

  it('asigna un pace intermedio a la fila más cercana', () => {
    expect(ritmoBasePorPace(320)).toBe('moderado'); // 5:20, más cerca de 5:00 que de 6:00
    expect(ritmoBasePorPace(345)).toBe('promedio'); // 5:45, más cerca de 6:00
    expect(ritmoBasePorPace(500)).toBe('suave'); // más lento que toda la tabla
    // En un empate exacto gana la fila más conservadora (la más lenta).
    expect(ritmoBasePorPace(330)).toBe('promedio');
  });

  it('falla con un ritmo desconocido', () => {
    expect(() => filaDeProgresion('inexistente' as never)).toThrow();
  });
});

describe('incremento semanal', () => {
  it('usa el piso del rango por defecto (criterio conservador)', () => {
    expect(calcularIncrementoSemanal('promedio', '10K', false)).toBe(2);
  });

  it('usa el techo del rango sólo si se pide explícitamente', () => {
    expect(calcularIncrementoSemanal('promedio', '10K', false, 'maximo')).toBe(3);
  });

  it('con fatiga externa toma SIEMPRE el piso, aunque se pida el máximo', () => {
    expect(calcularIncrementoSemanal('promedio', '10K', true, 'maximo')).toBe(2);
    expect(calcularIncrementoSemanal('ultra', '42K', true, 'maximo')).toBe(7);
  });

  it('expone el rango completo para mostrarlo en la UI', () => {
    expect(rangoIncrementoSemanal('moderado', '42K')).toEqual([3, 5]);
  });
});

describe('aplicar la progresión semana a semana', () => {
  it('suma el incremento en semana de carga', () => {
    expect(aplicarProgresion(20, false, 2)).toBe(22);
  });

  it('baja al 80% en semana de descarga, sin sumar', () => {
    expect(aplicarProgresion(24, true, 2)).toBe(Math.round(24 * DELOAD_VOLUME_FACTOR * 2) / 2);
  });

  it('redondea a medio km', () => {
    expect(aplicarProgresion(20, false, 2.5)).toBe(22.5);
    expect(aplicarProgresion(21.3, false, 2)).toBe(23.5);
  });
});

describe('ejemplo canónico de la metodología: 10K, ritmo Promedio, esquema 3:1', () => {
  const cargas = secuenciaDeCargas('3:1', 4);
  const volumenes = proyectarVolumen(20, cargas, 'promedio', '10K');

  it('sigue la secuencia carga / carga+ / carga++ / descarga', () => {
    expect(cargas).toEqual(['carga', 'carga+', 'carga++', 'descarga']);
  });

  it('progresa 20 → 22 → 24 y descarga a ~19-20', () => {
    expect(volumenes.slice(0, 3)).toEqual([20, 22, 24]);
    expect(volumenes[3]!).toBeGreaterThanOrEqual(18);
    expect(volumenes[3]!).toBeLessThanOrEqual(20);
  });

  it('con fatiga externa no progresa más rápido que el piso del rango', () => {
    const conFatiga = proyectarVolumen(20, cargas, 'promedio', '10K', true);
    expect(conFatiga.slice(0, 3)).toEqual([20, 22, 24]);
  });

  it('en modo máximo progresa 20 → 23 → 26', () => {
    const maximo = proyectarVolumen(20, cargas, 'promedio', '10K', false, 'maximo');
    expect(maximo.slice(0, 3)).toEqual([20, 23, 26]);
  });
});

describe('proyección de volumen en varios mesociclos', () => {
  it('retoma la carga desde el pico previo, no desde la descarga', () => {
    const cargas = secuenciaDeCargas('3:1', 8);
    const volumenes = proyectarVolumen(20, cargas, 'promedio', '10K');

    // Semanas 1-4: 20, 22, 24, descarga. Semana 5 retoma desde 24, no desde 19.5.
    expect(volumenes[4]!).toBe(26);
    expect(volumenes[4]!).toBeGreaterThan(volumenes[3]!);
  });

  it('nunca produce un volumen negativo o cero', () => {
    const cargas = secuenciaDeCargas('1:1', 12);
    for (const km of proyectarVolumen(15, cargas, 'suave', '5K')) {
      expect(km).toBeGreaterThan(0);
    }
  });

  it('devuelve un volumen por semana pedida', () => {
    expect(proyectarVolumen(20, secuenciaDeCargas('2:1', 9), 'moderado', '21K')).toHaveLength(9);
  });
});
