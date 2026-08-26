import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cadenciaDesdePasos,
  detectarFormato,
  distanciaTotal,
  elegirMejorFormato,
  haversine,
  parseActivityFile,
  parseGPX,
  parseKML,
  parseTCX,
  reconciliarDistancia,
  splitsPorKm,
} from '@/domain/import';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf8');

describe('haversine', () => {
  it('da 0 para el mismo punto', () => {
    expect(haversine(-34.6037, -58.3816, -34.6037, -58.3816)).toBe(0);
  });

  it('calcula ~111.2 km por grado de latitud', () => {
    const meters = haversine(0, 0, 1, 0);
    expect(meters).toBeGreaterThan(111_000);
    expect(meters).toBeLessThan(111_400);
  });

  it('es simétrico', () => {
    const a = haversine(-34.6, -58.38, -34.59, -58.37);
    const b = haversine(-34.59, -58.37, -34.6, -58.38);
    expect(a).toBeCloseTo(b, 6);
  });

  it('mide distancias cortas de running con precisión de metros', () => {
    // 100 m al norte desde el punto de partida.
    const meters = haversine(-34.6037, -58.3816, -34.6037 + 100 / 111_320, -58.3816);
    expect(meters).toBeCloseTo(100, 0);
  });
});

describe('cadencia desde pasos', () => {
  it('deriva pasos por minuto del total del lap', () => {
    // 4373 pasos en 1798 s ≈ 30 min → ~146 spm.
    expect(cadenciaDesdePasos(4373, 1798)).toBe(146);
  });

  it('devuelve undefined si falta alguno de los dos datos', () => {
    expect(cadenciaDesdePasos(0, 1798)).toBeUndefined();
    expect(cadenciaDesdePasos(4373, 0)).toBeUndefined();
  });
});

describe('reconciliación de distancia', () => {
  it('usa la calculada si el archivo no declara ninguna', () => {
    const result = reconciliarDistancia(4487.2);
    expect(result.distanceMeters).toBe(4487);
    expect(result.warnings).toHaveLength(0);
  });

  it('prefiere la del dispositivo y no avisa si están dentro de la tolerancia', () => {
    const result = reconciliarDistancia(4490, 4500);
    expect(result.distanceMeters).toBe(4500);
    expect(result.warnings).toHaveLength(0);
  });

  it('avisa cuando la discrepancia supera la tolerancia', () => {
    const result = reconciliarDistancia(4000, 4500);
    expect(result.distanceMeters).toBe(4500);
    expect(result.warnings[0]).toMatch(/difiere/);
  });
});

describe('splits por km', () => {
  it('devuelve vacío con menos de dos puntos', () => {
    expect(splitsPorKm([])).toEqual([]);
    expect(splitsPorKm([{ lat: 0, lon: 0, time: 0 }])).toEqual([]);
  });

  it('parte una traza uniforme en km completos con el pace correcto', () => {
    // ~3 km a 5:00/km, un punto cada ~100 m. La conversión grados→metros es
    // aproximada, así que el tercer km queda apenas corto y sale como cola.
    const points = [];
    for (let i = 0; i <= 30; i++) {
      points.push({
        lat: (i * 100) / 111_320,
        lon: 0,
        time: i * 30_000, // 100 m cada 30 s = 5:00/km
      });
    }
    const splits = splitsPorKm(points);
    expect(splits.map((s) => s.km)).toEqual([1, 2, 3]);
    // Los dos primeros son km completos exactos.
    expect(splits[0]!.meters).toBe(1000);
    expect(splits[1]!.meters).toBe(1000);
    // Todos comparten el mismo pace, porque la velocidad es constante.
    for (const split of splits) {
      expect(split.paceSecPerKm).toBeGreaterThanOrEqual(299);
      expect(split.paceSecPerKm).toBeLessThanOrEqual(301);
    }
  });

  it('reporta la cola parcial extrapolando su pace al km entero', () => {
    const points = [];
    for (let i = 0; i <= 15; i++) {
      points.push({ lat: (i * 100) / 111_320, lon: 0, time: i * 30_000 });
    }
    const splits = splitsPorKm(points);
    expect(splits).toHaveLength(2);
    expect(splits[1]!.meters).toBeGreaterThan(400);
    expect(splits[1]!.meters).toBeLessThan(600);
    expect(splits[1]!.paceSecPerKm).toBeGreaterThanOrEqual(299);
    expect(splits[1]!.paceSecPerKm).toBeLessThanOrEqual(301);
  });
});

describe('detección de formato', () => {
  it('usa la extensión del archivo cuando está', () => {
    expect(detectarFormato('<gpx>', 'salida.TCX')).toBe('tcx');
  });

  it('reconoce el contenido cuando no hay extensión útil', () => {
    expect(detectarFormato('<?xml version="1.0"?><TrainingCenterDatabase>')).toBe('tcx');
    expect(detectarFormato('<?xml version="1.0"?><gpx version="1.1">')).toBe('gpx');
    expect(detectarFormato('<?xml version="1.0"?><kml xmlns="...">')).toBe('kml');
  });

  it('falla con un formato desconocido', () => {
    expect(() => detectarFormato('{"json": true}')).toThrow(/TCX, GPX y KML/);
  });

  it('prioriza TCX sobre GPX sobre KML', () => {
    expect(elegirMejorFormato(['kml', 'gpx', 'tcx'])).toBe('tcx');
    expect(elegirMejorFormato(['kml', 'gpx'])).toBe('gpx');
    expect(elegirMejorFormato(['kml'])).toBe('kml');
    expect(elegirMejorFormato([])).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Caso de prueba real: TCX exportado por un reloj Xiaomi ("Mi Fitness").
// 1799 puntos a 1 Hz, ~4.5 km, ~30 min, FC media 160, 4373 pasos, 394 kcal.
// ─────────────────────────────────────────────────────────────────────────────

describe('TCX real de Mi Fitness (caso de campo)', () => {
  const activity = parseTCX(fixture('run-mifitness.tcx'));

  it('identifica el formato y el dispositivo', () => {
    expect(activity.format).toBe('tcx');
    expect(activity.creator).toBe('Mi Fitness');
  });

  it('lee los 1799 trackpoints a 1 Hz', () => {
    expect(activity.points).toHaveLength(1799);
    const gap = activity.points[1]!.time - activity.points[0]!.time;
    expect(gap).toBe(1000);
  });

  it('extrae el resumen del Lap completo', () => {
    expect(activity.lap).toMatchObject({
      distanceMeters: 4500,
      totalTimeSeconds: 1798,
      calories: 394,
      averageHeartRateBpm: 160,
      steps: 4373,
    });
    expect(activity.lap!.averageSpeedMps).toBeCloseTo(2.5028, 4);
  });

  it('usa la distancia declarada por el reloj, coherente con la calculada', () => {
    expect(activity.distanceMeters).toBe(4500);
    expect(activity.computedDistanceMeters).toBeGreaterThan(4400);
    expect(activity.computedDistanceMeters).toBeLessThan(4600);
    expect(activity.declaredDistanceMeters).toBe(4500);
  });

  it('toma la duración del Lap: ~30 min', () => {
    expect(activity.durationSeconds).toBe(1798);
    expect(activity.durationSeconds / 60).toBeCloseTo(30, 0);
  });

  it('calcula el pace medio en ~6:40 /km', () => {
    // 1798 s / 4.5 km = 399.6 s/km.
    expect(activity.paceSecPerKm).toBe(400);
  });

  it('deriva la cadencia media desde los pasos del Lap', () => {
    expect(activity.cadenceSpm).toBe(146);
  });

  it('produce 5 splits: 4 km completos y la cola parcial', () => {
    expect(activity.splits).toHaveLength(5);
    expect(activity.splits.slice(0, 4).every((s) => s.meters === 1000)).toBe(true);
    expect(activity.splits[4]!.meters).toBeLessThan(1000);
  });

  it('avisa que la FC viene sólo como promedio de sesión, no punto a punto', () => {
    expect(activity.points.every((p) => p.heartRate === undefined)).toBe(true);
    expect(activity.warnings.join(' ')).toMatch(/promedio de la sesión/);
  });

  it('se parsea igual entrando por el detector de formato', () => {
    const viaDetector = parseActivityFile(fixture('run-mifitness.tcx'), {
      fileName: 'run-mifitness.tcx',
    });
    expect(viaDetector.distanceMeters).toBe(activity.distanceMeters);
    expect(viaDetector.cadenceSpm).toBe(activity.cadenceSpm);
  });
});

describe('parser TCX — casos de borde', () => {
  it('falla con un XML que no es una actividad', () => {
    expect(() => parseTCX('<?xml version="1.0"?><TrainingCenterDatabase/>')).toThrow(
      /no contiene ninguna actividad/,
    );
  });

  it('falla si la actividad no tiene puntos con posición', () => {
    const xml = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity>
      <Lap><Track><Trackpoint><Time>2026-03-14T09:00:00Z</Time></Trackpoint></Track></Lap>
    </Activity></Activities></TrainingCenterDatabase>`;
    expect(() => parseTCX(xml)).toThrow(/puntos de ruta/);
  });

  it('rechaza un XML inválido', () => {
    expect(() => parseTCX('esto no es xml <<<')).toThrow();
  });

  it('usa la FC por punto cuando el reloj sí la trae', () => {
    const xml = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity>
      <Lap><TotalTimeSeconds>2</TotalTimeSeconds><DistanceMeters>10</DistanceMeters><Track>
        <Trackpoint><Time>2026-03-14T09:00:00Z</Time>
          <Position><LatitudeDegrees>-34.6</LatitudeDegrees><LongitudeDegrees>-58.4</LongitudeDegrees></Position>
          <HeartRateBpm><Value>145</Value></HeartRateBpm>
        </Trackpoint>
        <Trackpoint><Time>2026-03-14T09:00:02Z</Time>
          <Position><LatitudeDegrees>-34.5999</LatitudeDegrees><LongitudeDegrees>-58.4</LongitudeDegrees></Position>
          <HeartRateBpm><Value>150</Value></HeartRateBpm>
        </Trackpoint>
      </Track></Lap>
    </Activity></Activities></TrainingCenterDatabase>`;
    const activity = parseTCX(xml);
    expect(activity.points[0]!.heartRate).toBe(145);
    expect(activity.points[1]!.heartRate).toBe(150);
    expect(activity.warnings.join(' ')).not.toMatch(/promedio de la sesión/);
  });

  it('suma los laps de una actividad con varios', () => {
    const lap = (start: string, t: string, dist: number, hr: number, steps: number) => `
      <Lap StartTime="${start}">
        <TotalTimeSeconds>${t}</TotalTimeSeconds>
        <DistanceMeters>${dist}</DistanceMeters>
        <AverageHeartRateBpm><Value>${hr}</Value></AverageHeartRateBpm>
        <Steps>${steps}</Steps>
        <Track>
          <Trackpoint><Time>${start}</Time>
            <Position><LatitudeDegrees>-34.6</LatitudeDegrees><LongitudeDegrees>-58.4</LongitudeDegrees></Position>
          </Trackpoint>
          <Trackpoint><Time>${start.replace(':00Z', ':30Z')}</Time>
            <Position><LatitudeDegrees>-34.599</LatitudeDegrees><LongitudeDegrees>-58.4</LongitudeDegrees></Position>
          </Trackpoint>
        </Track>
      </Lap>`;
    const xml = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity>
      ${lap('2026-03-14T09:00:00Z', '600', 2000, 150, 1000)}
      ${lap('2026-03-14T09:10:00Z', '600', 2000, 170, 1200)}
    </Activity></Activities></TrainingCenterDatabase>`;
    const activity = parseTCX(xml);
    expect(activity.lap!.distanceMeters).toBe(4000);
    expect(activity.lap!.totalTimeSeconds).toBe(1200);
    expect(activity.lap!.steps).toBe(2200);
    // Promedio ponderado por tiempo: laps iguales → media simple.
    expect(activity.lap!.averageHeartRateBpm).toBe(160);
  });
});

describe('parser GPX (respaldo)', () => {
  const gpx = `<?xml version="1.0"?>
    <gpx version="1.1" creator="Umbral Test"
      xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
      <trk><trkseg>
        <trkpt lat="-34.6037" lon="-58.3816"><ele>25</ele><time>2026-03-14T09:00:00Z</time></trkpt>
        <trkpt lat="-34.6028" lon="-58.3816"><ele>26</ele><time>2026-03-14T09:00:30Z</time></trkpt>
        <trkpt lat="-34.6019" lon="-58.3816"><ele>27</ele><time>2026-03-14T09:01:00Z</time></trkpt>
      </trkseg></trk>
    </gpx>`;

  it('lee posición, tiempo y elevación', () => {
    const activity = parseGPX(gpx);
    expect(activity.format).toBe('gpx');
    expect(activity.creator).toBe('Umbral Test');
    expect(activity.points).toHaveLength(3);
    expect(activity.points[0]!.elevation).toBe(25);
  });

  it('calcula distancia y duración desde la traza', () => {
    const activity = parseGPX(gpx);
    // 2 tramos de ~100 m cada uno.
    expect(activity.distanceMeters).toBeGreaterThan(180);
    expect(activity.distanceMeters).toBeLessThan(220);
    expect(activity.durationSeconds).toBe(60);
    expect(activity.paceSecPerKm).toBeGreaterThan(0);
  });

  it('avisa que no trae FC y sigue funcionando', () => {
    const activity = parseGPX(gpx);
    expect(activity.warnings.join(' ')).toMatch(/no trae frecuencia cardíaca/);
    expect(activity.lap).toBeUndefined();
  });

  it('lee la FC de la extensión de Garmin cuando está', () => {
    const conHr = gpx.replace(
      '<time>2026-03-14T09:00:00Z</time>',
      '<time>2026-03-14T09:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>142</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>',
    );
    expect(parseGPX(conHr).points[0]!.heartRate).toBe(142);
  });

  it('descuenta las pausas largas de la duración', () => {
    const conPausa = gpx.replace('09:01:00Z', '09:20:00Z');
    // El salto de 19 min se descarta: queda sólo el primer tramo de 30 s.
    expect(parseGPX(conPausa).durationSeconds).toBe(30);
  });

  it('falla si no hay puntos', () => {
    expect(() => parseGPX('<?xml version="1.0"?><gpx><trk><trkseg/></trk></gpx>')).toThrow(
      /no contiene puntos/,
    );
  });
});

describe('parser KML (último recurso)', () => {
  it('lee un gx:Track con tiempos', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
        <Placemark><gx:Track>
          <when>2026-03-14T09:00:00Z</when>
          <gx:coord>-58.3816 -34.6037 0</gx:coord>
          <when>2026-03-14T09:00:30Z</when>
          <gx:coord>-58.3816 -34.6028 0</gx:coord>
        </gx:Track></Placemark>
      </kml>`;
    const activity = parseKML(kml);
    expect(activity.format).toBe('kml');
    expect(activity.points).toHaveLength(2);
    // En KML el orden es lon,lat — el parser tiene que darlos vuelta.
    expect(activity.points[0]!.lat).toBeCloseTo(-34.6037, 4);
    expect(activity.points[0]!.lon).toBeCloseTo(-58.3816, 4);
    expect(activity.durationSeconds).toBe(30);
  });

  it('lee un LineString sin tiempos y avisa que no hay pace', () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><LineString>
        <coordinates>-58.3816,-34.6037,0 -58.3816,-34.6028,0 -58.3816,-34.6019,0</coordinates>
      </LineString></Placemark></kml>`;
    const activity = parseKML(kml);
    expect(activity.points).toHaveLength(3);
    expect(activity.paceSecPerKm).toBeNull();
    expect(activity.splits).toEqual([]);
    expect(activity.warnings.join(' ')).toMatch(/no trae marcas de tiempo/);
  });

  it('siempre advierte sobre las limitaciones del formato', () => {
    const kml = `<?xml version="1.0"?><kml><Placemark><LineString>
      <coordinates>-58.3816,-34.6037 -58.3816,-34.6028</coordinates>
    </LineString></Placemark></kml>`;
    expect(parseKML(kml).warnings.join(' ')).toMatch(/mejor usá ese/);
  });

  it('falla si no hay coordenadas', () => {
    expect(() => parseKML('<?xml version="1.0"?><kml><Document/></kml>')).toThrow(
      /no contiene coordenadas/,
    );
  });
});

describe('distancia total sobre la traza', () => {
  it('suma los tramos punto a punto', () => {
    const points = [
      { lat: 0, lon: 0, time: 0 },
      { lat: 100 / 111_320, lon: 0, time: 1000 },
      { lat: 200 / 111_320, lon: 0, time: 2000 },
    ];
    expect(distanciaTotal(points)).toBeCloseTo(200, 0);
  });

  it('da 0 con un solo punto', () => {
    expect(distanciaTotal([{ lat: 0, lon: 0, time: 0 }])).toBe(0);
  });
});
