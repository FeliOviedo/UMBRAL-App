import { Link } from 'react-router-dom';
import { TRAINING_TYPE_TARGETS } from '@/domain';
import type { LoadWeek } from '@/domain/types';
import { useSession } from '@/store/session.store';
import type { SemanaPlanificada } from '@/data';
import { Button } from '@/components/ui/button';
import { Aviso, Vacio } from '@/components/ui/feedback';
import { formatearFechaLarga, formatearKm, formatearTiempo, hoyIso } from '@/lib/format';

const ETIQUETA_CARGA: Record<LoadWeek, string> = {
  carga: 'Carga',
  'carga+': 'Carga +',
  'carga++': 'Carga ++',
  descarga: 'Descarga',
};

/**
 * El macrociclo completo, semana por semana.
 *
 * La semana en curso se resalta y el resto queda en gris: en una lista de hasta
 * 28 semanas, lo único que el usuario necesita ubicar de un vistazo es dónde
 * está parado hoy.
 */
export default function PlanScreen() {
  const plan = useSession((s) => s.plan);
  const objetivo = useSession((s) => s.objetivo);

  if (!plan || !objetivo) {
    return (
      <main className="mx-auto w-full max-w-md px-6 pb-16">
        <Vacio titulo="Todavía no tenés un plan">
          <p>Definí tu objetivo y lo armamos con tu umbral y tu volumen actual.</p>
          <Button asChild size="block" className="mt-8">
            <Link to="/objetivo">Definir mi objetivo</Link>
          </Button>
        </Vacio>
      </main>
    );
  }

  const hoy = hoyIso();
  const semanaActual = plan.semanas.find(
    (s) => hoy >= s.fechaInicio && hoy < sumar7(s.fechaInicio),
  );
  const kmPico = Math.max(...plan.semanas.map((s) => s.totalKm), 0);

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">Mi plan</p>
        <h1 className="mt-6 u-hero">
          {objetivo.distancia}
          <span className="ml-3 font-sans text-base font-medium text-fg-muted">
            en {formatearTiempo(objetivo.tiempoObjetivoSeg)}
          </span>
        </h1>
        <p className="u-sub mt-2">
          {formatearFechaLarga(objetivo.fechaCarrera)} · {plan.semanasTotales} semanas ·{' '}
          {plan.diasPorSemana} días por semana
        </p>
      </header>

      {plan.avisos.length > 0 && (
        <section className="u-section border-t border-border space-y-4">
          {plan.avisos.map((aviso) => (
            <Aviso key={aviso}>{aviso}</Aviso>
          ))}
        </section>
      )}

      <section className="u-section border-t border-border">
        <div className="flex items-baseline gap-8">
          <div>
            <p className="font-hero text-hero-sm">{formatearKm(kmPico)}</p>
            <p className="u-label mt-2">Km en tu pico</p>
          </div>
          <div>
            <p className="font-hero text-hero-sm">{plan.semanasBase}</p>
            <p className="u-label mt-2">Semanas de base</p>
          </div>
        </div>
        <p className="u-sub mt-6">
          Arrancás en {formatearKm(plan.volumenInicialKm)} km por semana con el esquema{' '}
          {plan.esquema}. El volumen sube en las semanas de carga y baja en las de descarga.
        </p>
      </section>

      <section className="u-section border-t border-border">
        <h2 className="u-section-title">Semana a semana</h2>
        <ol className="mt-8 space-y-5">
          {plan.semanas.map((semana) => (
            <FilaSemana
              key={semana.id}
              semana={semana}
              esActual={semana.id === semanaActual?.id}
              kmPico={kmPico}
            />
          ))}
        </ol>
      </section>
    </main>
  );
}

function FilaSemana({
  semana,
  esActual,
  kmPico,
}: {
  semana: SemanaPlanificada;
  esActual: boolean;
  kmPico: number;
}) {
  const proporcion = kmPico > 0 ? semana.totalKm / kmPico : 0;
  const esDescarga = semana.carga === 'descarga';

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span
            className={
              esActual ? 'u-table text-accent' : 'u-table text-fg-muted'
            }
          >
            S{semana.numero}
          </span>
          <span className={esActual ? 'u-sub text-fg' : 'u-sub'}>
            {ETIQUETA_CARGA[semana.carga]}
            {esActual && ' · esta semana'}
          </span>
        </div>
        <span className={esActual ? 'u-table text-fg' : 'u-table text-fg-muted'}>
          {formatearKm(semana.totalKm)} km
        </span>
      </div>

      {/* Barra de volumen: el perfil en escalera del plan se lee de un vistazo. */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-sm bg-surface">
        <div
          className={esDescarga ? 'h-full bg-zone-z1' : esActual ? 'h-full bg-accent' : 'h-full bg-zone-z2'}
          style={{ width: `${Math.round(proporcion * 100)}%` }}
        />
      </div>

      {esActual && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {semana.dias.map((dia) => (
            <li key={dia.id} className="u-sub">
              <span className="text-fg">{dia.tipo}</span>
              {dia.km > 0 && ` ${formatearKm(dia.km)}km`}
              {dia.rpeObjetivo !== null && ` · RPE ${dia.rpeObjetivo}`}
              <span className="sr-only"> ({TRAINING_TYPE_TARGETS[dia.tipo].label})</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function sumar7(fechaIso: string): string {
  return new Date(Date.parse(`${fechaIso}T00:00:00Z`) + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
