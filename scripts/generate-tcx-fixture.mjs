/**
 * Genera el fixture TCX de referencia de los tests.
 *
 * Reproduce un archivo real de un reloj Xiaomi ("Mi Fitness"): 1799 puntos a
 * 1 Hz (~30 min), ~4.5 km, FC sólo como promedio del Lap (160 ppm), 4373 pasos
 * y 394 kcal. Los trackpoints traen únicamente Time + Position, que es la
 * limitación que el parser tiene que tolerar.
 *
 * Se ejecuta a mano y su salida se versiona:
 *   node scripts/generate-tcx-fixture.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const POINTS = 1799;
const TOTAL_METERS = 4500;
const START = Date.parse('2026-03-14T09:00:00Z');

// Ruta sintética: un recorrido en línea hacia el norte desde un punto de Buenos
// Aires, con la distancia repartida en partes iguales entre puntos.
const START_LAT = -34.6037;
const START_LON = -58.3816;
const METERS_PER_DEGREE_LAT = 111_320;

const step = TOTAL_METERS / (POINTS - 1);

const trackpoints = [];
for (let i = 0; i < POINTS; i++) {
  const time = new Date(START + i * 1000).toISOString().replace('.000Z', 'Z');
  const lat = START_LAT + (i * step) / METERS_PER_DEGREE_LAT;
  trackpoints.push(
    [
      '        <Trackpoint>',
      `          <Time>${time}</Time>`,
      '          <Position>',
      `            <LatitudeDegrees>${lat.toFixed(7)}</LatitudeDegrees>`,
      `            <LongitudeDegrees>${START_LON.toFixed(7)}</LongitudeDegrees>`,
      '          </Position>',
      '        </Trackpoint>',
    ].join('\n'),
  );
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities>
    <Activity Sport="Running">
      <Id>${new Date(START).toISOString().replace('.000Z', 'Z')}</Id>
      <Lap StartTime="${new Date(START).toISOString().replace('.000Z', 'Z')}">
        <TotalTimeSeconds>1798</TotalTimeSeconds>
        <DistanceMeters>4500</DistanceMeters>
        <Calories>394</Calories>
        <AverageHeartRateBpm>
          <Value>160</Value>
        </AverageHeartRateBpm>
        <AverageSpeed>2.5028</AverageSpeed>
        <Steps>4373</Steps>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpoints.join('\n')}
        </Track>
      </Lap>
      <Creator xsi:type="Device_t" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <Name>Mi Fitness</Name>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'run-mifitness.tcx');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, xml, 'utf8');
console.log(`Escrito ${out} (${POINTS} puntos)`);
