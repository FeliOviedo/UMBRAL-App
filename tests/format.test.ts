import { describe, expect, it } from 'vitest';
import {
  formatearFechaCorta,
  formatearFechaLarga,
  formatearKm,
  formatearPaceCorto,
  formatearTiempo,
  parsearPace,
  parsearTiempo,
} from '@/lib/format';

describe('formatear tiempo', () => {
  it.each([
    [1500, '25:00'],
    [3600, '1:00:00'],
    [4500, '1:15:00'],
    [20_700, '5:45:00'],
    [59, '0:59'],
    [0, '0:00'],
  ])('%i s → %s', (segundos, esperado) => {
    expect(formatearTiempo(segundos)).toBe(esperado);
  });

  it('no muestra horas cuando no las hay', () => {
    expect(formatearTiempo(3599)).toBe('59:59');
  });
});

describe('parsear tiempo', () => {
  it('acepta h:mm:ss', () => {
    expect(parsearTiempo('1:15:00')).toBe(4500);
    expect(parsearTiempo('5:45:00')).toBe(20_700);
  });

  it('acepta mm:ss para las distancias cortas', () => {
    expect(parsearTiempo('25:00')).toBe(1500);
    expect(parsearTiempo('17:30')).toBe(1050);
  });

  it('tolera espacios alrededor', () => {
    expect(parsearTiempo('  25:00  ')).toBe(1500);
  });

  it('rechaza lo que no entiende', () => {
    expect(parsearTiempo('')).toBeNull();
    expect(parsearTiempo('veinticinco')).toBeNull();
    expect(parsearTiempo('25')).toBeNull();
    expect(parsearTiempo('1:2:3:4')).toBeNull();
  });

  it('rechaza minutos y segundos fuera de rango', () => {
    expect(parsearTiempo('1:75:00')).toBeNull();
    expect(parsearTiempo('25:99')).toBeNull();
  });

  it('es la inversa de formatear', () => {
    for (const segundos of [1500, 3600, 4500, 20_700]) {
      expect(parsearTiempo(formatearTiempo(segundos))).toBe(segundos);
    }
  });
});

describe('pace', () => {
  it.each([
    [300, '5:00'],
    [294, '4:54'],
    [420, '7:00'],
    [204, '3:24'],
  ])('%i s/km → %s', (sec, esperado) => {
    expect(formatearPaceCorto(sec)).toBe(esperado);
  });

  it('parsea de vuelta', () => {
    expect(parsearPace('5:00')).toBe(300);
    expect(parsearPace('4:40')).toBe(280);
  });

  it('rechaza formatos inválidos', () => {
    expect(parsearPace('5')).toBeNull();
    expect(parsearPace('5:75')).toBeNull();
    expect(parsearPace('')).toBeNull();
  });

  it('es la inversa de formatear', () => {
    for (const sec of [204, 276, 300, 420]) {
      expect(parsearPace(formatearPaceCorto(sec))).toBe(sec);
    }
  });
});

describe('formatear km', () => {
  it('omite el decimal cuando es redondo', () => {
    expect(formatearKm(24)).toBe('24');
    expect(formatearKm(24.5)).toBe('24.5');
  });
});

describe('fechas', () => {
  it('formatea sin correrse de día por zona horaria', () => {
    // Con parseo local en vez de UTC, esta fecha se mostraría como el 13 en
    // cualquier zona al oeste de Greenwich.
    expect(formatearFechaCorta('2026-03-14')).toContain('14');
    expect(formatearFechaLarga('2026-03-14')).toContain('14');
    expect(formatearFechaLarga('2026-03-14')).toContain('2026');
  });

  it('devuelve la entrada tal cual si no es una fecha', () => {
    expect(formatearFechaCorta('no-es-fecha')).toBe('no-es-fecha');
  });
});
