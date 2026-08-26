import { describe, expect, it } from 'vitest';
import { lunesDeLaSemana, sumarDias } from '@/lib/format';

describe('sumar días', () => {
  it('avanza dentro del mes', () => {
    expect(sumarDias('2026-03-14', 7)).toBe('2026-03-21');
  });

  it('cruza el fin de mes', () => {
    expect(sumarDias('2026-03-30', 3)).toBe('2026-04-02');
  });

  it('cruza el fin de año', () => {
    expect(sumarDias('2026-12-30', 5)).toBe('2027-01-04');
  });

  it('maneja el 29 de febrero de un año bisiesto', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(sumarDias('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('acepta días negativos', () => {
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rechaza fechas inválidas', () => {
    expect(() => sumarDias('mañana', 1)).toThrow(/Fecha inválida/);
  });

  it('no se corre de día sea cual sea la zona horaria del proceso', () => {
    // Se trabaja en UTC a propósito: las fechas del plan son días de
    // calendario, no instantes.
    const original = process.env.TZ;
    try {
      for (const tz of ['UTC', 'America/Argentina/Buenos_Aires', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        expect(sumarDias('2026-03-14', 1)).toBe('2026-03-15');
      }
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('lunes de la semana', () => {
  // 2026-03-14 es sábado.
  it.each([
    ['2026-03-09', '2026-03-09'], // lunes → él mismo
    ['2026-03-10', '2026-03-09'], // martes
    ['2026-03-13', '2026-03-09'], // viernes
    ['2026-03-14', '2026-03-09'], // sábado
    ['2026-03-15', '2026-03-09'], // domingo → el lunes anterior, no el siguiente
    ['2026-03-16', '2026-03-16'], // lunes siguiente
  ])('%s cae en la semana del %s', (fecha, esperado) => {
    expect(lunesDeLaSemana(fecha)).toBe(esperado);
  });

  it('es idempotente', () => {
    const lunes = lunesDeLaSemana('2026-03-14');
    expect(lunesDeLaSemana(lunes)).toBe(lunes);
  });

  it('rechaza fechas inválidas', () => {
    expect(() => lunesDeLaSemana('el lunes')).toThrow(/Fecha inválida/);
  });
});
