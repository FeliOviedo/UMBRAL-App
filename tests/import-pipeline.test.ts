import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseActivityFile } from '@/domain/import';
import {
  calcularCargaMetabolica,
  compararPlanReal,
  distribucionPorZona,
} from '@/domain/sessionAnalysis';
import { calcularPaceUmbral, generarZonasPace } from '@/domain/zones';

/**
 * Pipeline completo de la Fase 3, sobre el archivo real de un reloj Xiaomi:
 * importar → derivar métricas → analizar contra el umbral y el plan.
 *
 * Los tests de `import.test.ts` cubren cada parser por separado; éste verifica
 * que las piezas encajen entre sí, que es donde aparecen los desajustes de
 * unidades (metros vs km, segundos vs minutos) que ningún test unitario ve.
 */

const tcx = readFileSync(join(__dirname, 'fixtures', 'run-mifitness.tcx'), 'utf8');

describe('importar un TCX real y analizarlo de punta a punta', () => {
  const actividad = parseActivityFile(tcx, { fileName: 'run-mifitness.tcx' });

  it('produce todo lo que el formulario de registro necesita autocompletar', () => {
    expect(actividad.distanceMeters).toBe(4500);
    expect(actividad.durationSeconds).toBe(1798);
    expect(actividad.paceSecPerKm).toBe(400); // 6:40 /km
    expect(actividad.cadenceSpm).toBe(146);
    expect(actividad.lap?.averageHeartRateBpm).toBe(160);
    expect(actividad.points.length).toBeGreaterThan(0);
    expect(actividad.splits.length).toBeGreaterThan(0);
  });

  it('la traza sirve para dibujar el mapa: todos los puntos tienen lat/lon', () => {
    for (const punto of actividad.points) {
      expect(Number.isFinite(punto.lat)).toBe(true);
      expect(Number.isFinite(punto.lon)).toBe(true);
      expect(Math.abs(punto.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(punto.lon)).toBeLessThanOrEqual(180);
    }
  });

  it('calcula la carga metabólica desde la duración importada y el RPE cargado a mano', () => {
    // 1798 s ≈ 30 min. A RPE 5 → ~150.
    expect(calcularCargaMetabolica(actividad.durationSeconds, 5)).toBe(150);
  });

  it('reparte los splits entre las zonas del umbral del usuario', () => {
    // Un corredor cuyo test de 20 min dio 4:40/km.
    const paceUmbral = calcularPaceUmbral(280);
    const zonas = generarZonasPace(paceUmbral);
    const distribucion = distribucionPorZona(actividad.splits, zonas);

    expect(distribucion.length).toBeGreaterThan(0);

    // Los ~6:40/km de esta sesión están muy por debajo de un umbral de 4:54,
    // así que toda la sesión cae en la zona más suave.
    expect(distribucion.map((d) => d.zona)).toEqual(['Z1']);

    const totalSegundos = distribucion.reduce((sum, d) => sum + d.segundos, 0);
    const segundosDeSplits = actividad.splits.reduce((sum, s) => sum + s.seconds, 0);
    expect(totalSegundos).toBe(segundosDeSplits);
  });

  it('compara la sesión importada contra el día planificado sin errores de unidades', () => {
    // El plan pedía 5 km a RPE 4; corrió 4.5 km y lo sintió RPE 6.
    const comparacion = compararPlanReal(
      { km: 5, targetRpe: 4 },
      { distanceMeters: actividad.distanceMeters, rpe: 6 },
    );

    expect(comparacion.kmPlanificados).toBe(5);
    expect(comparacion.kmReales).toBe(4.5);
    expect(comparacion.diferenciaKm).toBe(-0.5);
    expect(comparacion.diferenciaRpe).toBe(2);
    expect(comparacion.esfuerzoPorEncimaDeLoEsperado).toBe(true);
  });

  it('el pace del archivo coincide con el que se derivaría de distancia y tiempo', () => {
    // Si estos dos divergieran, el formulario mostraría un pace y guardaría otro.
    const derivado = Math.round((actividad.durationSeconds / actividad.distanceMeters) * 1000);
    expect(actividad.paceSecPerKm).toBe(derivado);
  });

  it('los splits suman aproximadamente la distancia total', () => {
    const metros = actividad.splits.reduce((sum, s) => sum + s.meters, 0);
    // Los splits se calculan sobre la traza; la distancia final es la del
    // dispositivo. La diferencia tiene que ser chica.
    expect(Math.abs(metros - actividad.distanceMeters)).toBeLessThan(100);
  });
});
