import { Link, useNavigate } from 'react-router-dom';
import { MESOCYCLE_SCHEMES } from '@/domain';
import type { LoadWeek } from '@/domain/types';
import { useSession } from '@/store/session.store';
import type { SemanaPlanificada } from '@/data';
import { Button } from '@/components/ui/button';
import { Aviso, Vacio } from '@/components/ui/feedback';
import { formatearFechaLarga, formatearKm, formatearTiempo, hoyIso, sumarDias } from '@/lib/format';
import { cn } from '@/lib/utils';

const ETIQUETA_CARGA: Record<LoadWeek, string> = {
  carga: 'Carga',
  'carga+': 'Carga +',
  'carga++': 'Carga ++',
  descarga: 'Descarga',
};

/**
 * El macrociclo: resumen del plan y sus mesociclos.
 *
 * Es la vista más alta del plan — un vistazo al conjunto, no al detalle día a
 * día. Cada mesociclo lleva un resumen y sus semanas, que llevan a la vista de
 * microciclo (`/plan/semana/:numero`), que es donde se entrena de verdad.
 */
export default function PlanScreen() {
  const navigate = useNavigate();
  const plan = useSession((s) => s.plan);
  const objetivo = useSession((s) => s.objetivo);

  if (!plan || !objetivo) {
    return (
      <main className="mx-auto w-full max-w-md px-edge pb-16">
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
    (s) => hoy >= s.fechaInicio && hoy < sumarDias(s.fechaInicio, 7),
  );
  const kmPico = Math.max(...plan.semanas.map((s) => s.totalKm), 0);

  const mesociclos = agruparPorMesociclo(plan.semanas);

  return (
    <main className="mx-auto w-full max-w-md px-edge pb-16">
      <header className="u-section">
        <p className="u-label">Mi plan</p>
        <h1 className="mt-6 u-hero">
          {objetivo.distancia}
          <span className="ml-3 u-unit">
            en {formatearTiempo(objetivo.tiempoObjetivoSeg)}
          </span>
        </h1>
        <p className="u-sub mt-2">
          {formatearFechaLarga(objetivo.fechaCarrera)} · {plan.semanasTotales} semanas ·{' '}
          {plan.diasPorSemana} días por semana
        </p>
      </header>

      {plan.avisos.length > 0 && (
        <section className="u-section space-y-4">
          {plan.avisos.map((aviso) => (
            <Aviso key={aviso}>{aviso}</Aviso>
          ))}
        </section>
      )}

      <section className="u-section">
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
          {plan.esquema} ({MESOCYCLE_SCHEMES[plan.esquema].level}). El volumen sube en las semanas
          de carga y baja en las de descarga.
        </p>
      </section>

      {mesociclos.map(({ index, semanas }) => (
        <section key={index} className="u-section">
          <button
            type="button"
            onClick={() => navigate(`/plan/mesociclo/${index}`)}
            className="flex w-full items-baseline justify-between"
          >
            <h2 className="u-label">Mesociclo {index}</h2>
            <span className="u-sub">Ver detalle →</span>
          </button>

          <ol className="mt-6 space-y-5">
            {semanas.map((semana) => (
              <FilaSemana
                key={semana.id}
                semana={semana}
                esActual={semana.id === semanaActual?.id}
                kmPico={kmPico}
                onClick={() => navigate(`/plan/semana/${semana.numero}`)}
              />
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}

function agruparPorMesociclo(
  semanas: readonly SemanaPlanificada[],
): { index: number; semanas: SemanaPlanificada[] }[] {
  const grupos = new Map<number, SemanaPlanificada[]>();
  for (const semana of semanas) {
    const lista = grupos.get(semana.mesociclo) ?? [];
    lista.push(semana);
    grupos.set(semana.mesociclo, lista);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, semanas]) => ({ index, semanas }));
}

function FilaSemana({
  semana,
  esActual,
  kmPico,
  onClick,
}: {
  semana: SemanaPlanificada;
  esActual: boolean;
  kmPico: number;
  onClick: () => void;
}) {
  const proporcion = kmPico > 0 ? semana.totalKm / kmPico : 0;
  const esDescarga = semana.carga === 'descarga';

  return (
    <li>
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className={esActual ? 'u-data-sm text-accent' : 'u-data-sm text-fg-muted'}>
              S{semana.numero}
            </span>
            <span className={esActual ? 'u-sub text-fg' : 'u-sub'}>
              {ETIQUETA_CARGA[semana.carga]}
              {esActual && ' · esta semana'}
            </span>
          </div>
          <span className={esActual ? 'u-data-sm text-fg' : 'u-data-sm text-fg-muted'}>
            {formatearKm(semana.totalKm)} km
          </span>
        </div>

        {/* Barra de volumen: el perfil en escalera del plan se lee de un vistazo. */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-sm bg-surface">
          <div
            className={cn(
              'h-full',
              esDescarga ? 'bg-zone-z1' : esActual ? 'bg-accent' : 'bg-zone-z2',
            )}
            style={{ width: `${Math.round(proporcion * 100)}%` }}
          />
        </div>
      </button>
    </li>
  );
}
