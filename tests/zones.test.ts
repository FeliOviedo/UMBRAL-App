import { describe, expect, it } from 'vitest';
import { ZONES, PACE_ZONE_FACTORS } from '@/domain/config';
import {
  calcularLTHR,
  calcularPaceUmbral,
  formatearPace,
  generarZonasFC,
  generarZonasPace,
  zonaPorFC,
  zonaPorId,
  zonaPorRPE,
} from '@/domain/zones';

describe('cálculo del umbral', () => {
  it('toma el promedio tal cual en el test de 30 min', () => {
    expect(calcularLTHR(170, '30min')).toBe(170);
  });

  it('resta 5% en el test de 20 min', () => {
    expect(calcularLTHR(170, '20min')).toBe(162); // 170 * 0.95 = 161.5 → 162
  });

  it('rechaza valores no positivos', () => {
    expect(() => calcularLTHR(0, '30min')).toThrow();
    expect(() => calcularLTHR(Number.NaN, '30min')).toThrow();
  });

  it('afloja el pace del test de 20 min un 5% para llegar al umbral de 60 min', () => {
    // 4:40/km de test → 4:54/km de umbral.
    expect(calcularPaceUmbral(280)).toBe(294);
  });
});

describe('zonas de frecuencia cardíaca', () => {
  const lthr = 170;
  const zones = generarZonasFC(lthr);

  it('genera las 7 zonas de Friel en orden', () => {
    expect(zones.map((z) => z.id)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5a', 'Z5b', 'Z5c']);
  });

  it('deja Z1 sin piso y Z5c sin techo', () => {
    expect(zones[0]!.bpmMin).toBeNull();
    expect(zones[6]!.bpmMax).toBeNull();
  });

  it('calcula los bpm como porcentaje de la LTHR', () => {
    const z2 = zones.find((z) => z.id === 'Z2')!;
    expect(z2.bpmMin).toBe(Math.ceil(lthr * 0.85)); // 145
    expect(z2.bpmMax).toBe(Math.ceil(lthr * 0.9) - 1); // 152
  });

  it('marca el umbral al arrancar Z5a: el 100% de la LTHR', () => {
    expect(zones.find((z) => z.id === 'Z5a')!.bpmMin).toBe(lthr);
    expect(zones.find((z) => z.id === 'Z4')!.bpmMax).toBe(lthr - 1);
  });

  it('cubre la recta completa: cada zona empieza donde termina la anterior', () => {
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i]!.bpmMin!).toBe(zones[i - 1]!.bpmMax! + 1);
    }
  });

  it('clasifica cualquier FC entre 100 y 220 sin dejar huecos', () => {
    for (let bpm = 100; bpm <= 220; bpm++) {
      expect(() => zonaPorFC(bpm, lthr)).not.toThrow();
    }
  });
});

describe('zonas de pace', () => {
  const paceUmbral = 300; // 5:00 /km
  const zones = generarZonasPace(paceUmbral);

  it('ancla el extremo rápido de Z4 exactamente en el pace umbral', () => {
    const z4 = zones.find((z) => z.id === 'Z4')!;
    expect(z4.secPerKmFast).toBe(paceUmbral);
  });

  it('ordena las zonas de lenta a rápida (menos segundos por km)', () => {
    // Z2 es más lenta que Z4: su extremo rápido tiene MÁS segundos por km.
    const z2 = zones.find((z) => z.id === 'Z2')!;
    const z4 = zones.find((z) => z.id === 'Z4')!;
    expect(z2.secPerKmFast!).toBeGreaterThan(z4.secPerKmFast!);
  });

  it('mantiene fast < slow dentro de cada zona acotada', () => {
    for (const zone of zones) {
      if (zone.secPerKmFast !== null && zone.secPerKmSlow !== null) {
        expect(zone.secPerKmFast).toBeLessThan(zone.secPerKmSlow);
      }
    }
  });

  it('aplica los factores declarados en config', () => {
    const z3 = zones.find((z) => z.id === 'Z3')!;
    expect(z3.secPerKmFast).toBe(Math.round(paceUmbral * PACE_ZONE_FACTORS.Z3.fast!));
    expect(z3.secPerKmSlow).toBe(Math.round(paceUmbral * PACE_ZONE_FACTORS.Z3.slow!));
  });
});

describe('clasificación por RPE (camino principal)', () => {
  it.each([
    [1, 'Z1'],
    [3, 'Z1'],
    [4, 'Z2'],
    [5, 'Z2'],
    [6, 'Z3'],
    [7, 'Z4'],
    [8, 'Z5a'],
    [9, 'Z5b'],
    [10, 'Z5c'],
  ])('RPE %i cae en %s', (rpe, expected) => {
    expect(zonaPorRPE(rpe).id).toBe(expected);
  });

  it('cubre toda la escala 1-10 sin huecos', () => {
    for (let rpe = 1; rpe <= 10; rpe++) {
      expect(() => zonaPorRPE(rpe)).not.toThrow();
    }
  });

  it('rechaza un RPE fuera de escala', () => {
    expect(() => zonaPorRPE(0)).toThrow();
    expect(() => zonaPorRPE(11)).toThrow();
  });
});

describe('clasificación por FC (camino secundario)', () => {
  const lthr = 170;

  it.each([
    [120, 'Z1'],
    [148, 'Z2'],
    [156, 'Z3'],
    [166, 'Z4'],
    [172, 'Z5a'],
    [176, 'Z5b'],
    [185, 'Z5c'],
  ])('%i ppm cae en %s', (bpm, expected) => {
    expect(zonaPorFC(bpm, lthr).id).toBe(expected);
  });
});

describe('definiciones de zona', () => {
  it('cada zona trae las tres referencias: %LTHR, RPE y test del habla', () => {
    for (const zone of ZONES) {
      expect(zone.talkTest.length).toBeGreaterThan(0);
      expect(zone.rpeMin).toBeGreaterThanOrEqual(1);
      expect(zone.rpeMax).toBeLessThanOrEqual(10);
      expect(zone.rpeMin).toBeLessThanOrEqual(zone.rpeMax);
      expect(zone.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('los rangos de RPE no se solapan entre zonas', () => {
    const seen = new Set<number>();
    for (const zone of ZONES) {
      for (let rpe = zone.rpeMin; rpe <= zone.rpeMax; rpe++) {
        expect(seen.has(rpe)).toBe(false);
        seen.add(rpe);
      }
    }
    expect(seen.size).toBe(10);
  });

  it('busca una zona por id', () => {
    expect(zonaPorId('Z5b').name).toBe('Capacidad aeróbica');
    expect(() => zonaPorId('Z9' as never)).toThrow();
  });
});

describe('formato de pace', () => {
  it.each([
    [300, '5:00'],
    [294, '4:54'],
    [365, '6:05'],
  ])('%i s/km se muestra como %s', (sec, expected) => {
    expect(formatearPace(sec)).toBe(expected);
  });
});
