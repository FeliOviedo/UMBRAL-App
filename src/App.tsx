import { formatearPace, generarZonasFC, generarZonasPace } from './domain';

/**
 * Pantalla única de la Fase 1: una verificación visual del design system.
 *
 * No es una pantalla del producto — las pantallas reales llegan en la Fase 2 en
 * adelante. Sirve para ver las tipografías, la escala hero y los colores de zona
 * sobre datos reales que salen del dominio, no maquetados a mano.
 */
export default function App() {
  // Valores de ejemplo: la LTHR y el pace umbral que produciría un test real.
  const lthr = 168;
  const paceUmbral = 300; // 5:00 /km
  const hrZones = generarZonasFC(lthr);
  const paceZones = generarZonasPace(paceUmbral);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">Umbral</p>
        <h1 className="mt-6 u-hero">
          {formatearPace(paceUmbral)}
          <span className="ml-2 font-sans text-base font-medium text-fg-muted">/km</span>
        </h1>
        <p className="u-sub mt-2">Pace umbral · {lthr} ppm de LTHR</p>
      </header>

      <section className="u-section border-t border-border">
        <h2 className="u-section-title">Mis zonas</h2>
        <p className="u-sub mt-1">
          El RPE manda. La frecuencia cardíaca acompaña sólo cuando el reloj mide bien.
        </p>

        <ul className="mt-8 space-y-6">
          {hrZones.map((zone, i) => {
            const pace = paceZones[i]!;
            return (
              <li key={zone.id} className="flex gap-4">
                <span
                  aria-hidden
                  className="mt-1 h-10 w-1 shrink-0 rounded-sm"
                  style={{ backgroundColor: zone.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-base font-semibold">
                      {zone.id} · {zone.name}
                    </span>
                    <span className="u-table shrink-0 text-fg-muted">
                      RPE {zone.rpeMin === zone.rpeMax ? zone.rpeMin : `${zone.rpeMin}-${zone.rpeMax}`}
                    </span>
                  </div>
                  <p className="u-table mt-1 text-fg-muted">
                    {formatearRangoFC(zone.bpmMin, zone.bpmMax)} ·{' '}
                    {formatearRangoPace(pace.secPerKmFast, pace.secPerKmSlow)}
                  </p>
                  <p className="u-sub mt-1">{zone.talkTest}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function formatearRangoFC(min: number | null, max: number | null): string {
  if (min === null && max !== null) return `<${max} ppm`;
  if (min !== null && max === null) return `>${min} ppm`;
  return `${min}-${max} ppm`;
}

function formatearRangoPace(fast: number | null, slow: number | null): string {
  if (fast === null && slow !== null) return `+${formatearPace(slow)}`;
  if (fast !== null && slow === null) return `-${formatearPace(fast)}`;
  return `${formatearPace(fast!)}-${formatearPace(slow!)}`;
}
