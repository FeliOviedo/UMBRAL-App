import { Link } from 'react-router-dom';
import { generarZonasFC, generarZonasPace, ZONES } from '@/domain';
import type { HeartRateZone, PaceZone } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Vacio } from '@/components/ui/feedback';
import { formatearPaceCorto } from '@/lib/format';

/**
 * Mis Zonas: las siete zonas con sus TRES referencias.
 *
 * El orden de las columnas no es casual — RPE primero, después pace, y la FC
 * última. Es la jerarquía que predica la metodología, hecha visible: la FC está
 * porque suma, no porque mande.
 */
export default function ZonasScreen() {
  const umbral = useSession((s) => s.umbral);

  if (!umbral) {
    return (
      <main className="u-page pb-16">
        <Vacio titulo="Todavía no cargaste tu umbral">
          <p>Las zonas se derivan de él. Es un dato y sale en un test de 20 minutos.</p>
          <Button asChild size="block" className="mt-8">
            <Link to="/umbral">Cargar mi umbral</Link>
          </Button>
        </Vacio>
      </main>
    );
  }

  const zonasFc = umbral.lthr !== null ? generarZonasFC(umbral.lthr) : null;
  const zonasPace = umbral.pacePorKm !== null ? generarZonasPace(umbral.pacePorKm) : null;

  return (
    <main className="u-page pb-16">
      <header className="u-section">
        <p className="u-label">Mis zonas</p>
        {umbral.pacePorKm !== null ? (
          <>
            <h1 className="mt-6 u-hero">
              {formatearPaceCorto(umbral.pacePorKm)}
              <span className="ml-2 u-unit">/km</span>
            </h1>
            <p className="u-sub mt-2">
              Pace de umbral
              {umbral.lthr !== null && ` · ${umbral.lthr} ppm de LTHR`}
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 u-hero">
              {umbral.lthr}
              <span className="ml-2 u-unit">ppm</span>
            </h1>
            <p className="u-sub mt-2">Tu LTHR</p>
          </>
        )}
      </header>

      <section className="u-section">
        <h2 className="u-label">Cómo leerlas</h2>
        <p className="u-sub mt-2">
          El RPE es el que manda: no depende de que el reloj mida bien. El pace es la referencia
          objetiva. La frecuencia cardíaca acompaña, y sólo cuando te dé números coherentes.
        </p>
      </section>

      <section className="u-section">
        <ul className="space-y-8">
          {ZONES.map((zona, i) => (
            <FilaDeZona
              key={zona.id}
              zona={zona}
              zonaFc={zonasFc?.[i] ?? null}
              zonaPace={zonasPace?.[i] ?? null}
            />
          ))}
        </ul>
      </section>

      {(zonasFc === null || zonasPace === null) && (
        <section className="u-section">
          <p className="u-sub">
            {zonasPace === null
              ? 'Todavía no cargaste tu pace de umbral. Es la referencia más confiable de las tres.'
              : 'Todavía no cargaste tu LTHR. No es imprescindible, pero suma como dato de apoyo.'}
          </p>
          <Button asChild variant="outline" size="block" className="mt-6">
            <Link to="/umbral">Completar mi umbral</Link>
          </Button>
        </section>
      )}
    </main>
  );
}

function FilaDeZona({
  zona,
  zonaFc,
  zonaPace,
}: {
  zona: (typeof ZONES)[number];
  zonaFc: HeartRateZone | null;
  zonaPace: PaceZone | null;
}) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="mt-1.5 h-12 w-1 shrink-0 rounded-sm"
        style={{ backgroundColor: zona.color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="u-title-sm">
            {zona.id} · {zona.name}
          </h3>
          {/* El RPE es el dato protagonista de la fila: va con el acento. */}
          <span className="u-data-sm shrink-0 text-accent">
            RPE {zona.rpeMin === zona.rpeMax ? zona.rpeMin : `${zona.rpeMin}-${zona.rpeMax}`}
          </span>
        </div>

        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {zonaPace && (
            <div className="flex gap-1.5">
              <dt className="u-sub">Pace</dt>
              <dd className="u-data-sm text-fg">{rangoPace(zonaPace)}</dd>
            </div>
          )}
          {zonaFc && (
            <div className="flex gap-1.5">
              <dt className="u-sub">FC</dt>
              <dd className="u-data-sm text-fg-muted">{rangoFc(zonaFc)}</dd>
            </div>
          )}
        </dl>

        <p className="u-sub mt-2">{zona.talkTest}</p>
        <p className="u-sub mt-0.5 opacity-70">{zona.lthrLabel}</p>
      </div>
    </li>
  );
}

function rangoFc(zona: HeartRateZone): string {
  if (zona.bpmMin === null) return `hasta ${zona.bpmMax} ppm`;
  if (zona.bpmMax === null) return `${zona.bpmMin}+ ppm`;
  return `${zona.bpmMin}-${zona.bpmMax} ppm`;
}

function rangoPace(zona: PaceZone): string {
  if (zona.secPerKmFast === null) return `${formatearPaceCorto(zona.secPerKmSlow!)} o más`;
  if (zona.secPerKmSlow === null) return `${formatearPaceCorto(zona.secPerKmFast)} o menos`;
  return `${formatearPaceCorto(zona.secPerKmFast)}-${formatearPaceCorto(zona.secPerKmSlow)}`;
}
