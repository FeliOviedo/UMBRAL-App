import { Link, useNavigate } from 'react-router-dom';
import { MESOCYCLE_SCHEMES } from '@/domain';
import { useSession } from '@/store/session.store';
import type { SemanaPlanificada } from '@/data';
import { Button } from '@/components/ui/button';
import { Aviso, Vacio } from '@/components/ui/feedback';
import { formatearFechaCorta, formatearFechaLarga, formatearKm, formatearTiempo, hoyIso, sumarDias } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * El macrociclo: de un vistazo, todos los mesociclos del plan.
 *
 * Antes esta pantalla listaba las semanas de TODOS los mesociclos, una abajo
 * de la otra — para un plan de 28 semanas eran 28 filas antes de llegar al
 * final. Ahora los mesociclos son tarjetas: cada una resume su rango de
 * volumen con mini-barras, y "ver todo el plan" es hojear la grilla en vez de
 * scrollear un listado plano. El detalle semana a semana sigue en
 * `/plan/mesociclo/:index`, que es donde de verdad hace falta.
 */
export default function PlanScreen() {
  const navigate = useNavigate();
  const plan = useSession((s) => s.plan);
  const objetivo = useSession((s) => s.objetivo);

  if (!plan || !objetivo) {
    return (
      <main className="u-page pb-16">
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
    <main className="u-page pb-16">
      <header className="u-section">
        <p className="u-label">Mi plan</p>
        <h1 className="mt-6 u-hero">
          {objetivo.distancia}
          <span className="ml-3 u-unit">en {formatearTiempo(objetivo.tiempoObjetivoSeg)}</span>
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
        {semanaActual && (
          <Button
            variant="outline"
            size="block"
            className="mt-6"
            onClick={() => navigate(`/plan/semana/${semanaActual.numero}`)}
          >
            Ir a esta semana (S{semanaActual.numero})
          </Button>
        )}
      </section>

      <section className="u-section">
        <h2 className="u-label">Todos los mesociclos</h2>
        <div className="mt-6 u-grid">
          {mesociclos.map(({ index, semanas }) => (
            <TarjetaMesociclo
              key={index}
              index={index}
              semanas={semanas}
              kmPico={kmPico}
              semanaActualId={semanaActual?.id}
              esquemaLevel={MESOCYCLE_SCHEMES[plan.esquema].level}
              onClick={() => navigate(`/plan/mesociclo/${index}`)}
            />
          ))}
        </div>
      </section>
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

/**
 * Una tarjeta por mesociclo: rango de semanas, mini-barras de volumen y si
 * "esta semana" cae adentro. Reemplaza la lista plana de semanas — acá el
 * conjunto se lee de un vistazo, y el detalle día a día vive un click después.
 */
function TarjetaMesociclo({
  index,
  semanas,
  kmPico,
  semanaActualId,
  esquemaLevel,
  onClick,
}: {
  index: number;
  semanas: SemanaPlanificada[];
  kmPico: number;
  semanaActualId: string | undefined;
  esquemaLevel: string;
  onClick: () => void;
}) {
  const contieneActual = semanas.some((s) => s.id === semanaActualId);
  const kmMesociclo = Math.round(semanas.reduce((sum, s) => sum + s.totalKm, 0));

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-4 border p-5 text-left transition-colors',
        contieneActual ? 'border-accent' : 'border-border hover:border-outline',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="u-label">Mesociclo {index}</p>
          <p className="u-title-sm mt-1">{esquemaLevel}</p>
        </div>
        {contieneActual && <span className="u-label text-accent">Esta semana</span>}
      </div>

      {/* Mini-barras: el perfil de carga del mesociclo, sin necesitar la lista completa. */}
      <div className="flex h-12 items-end gap-1">
        {semanas.map((semana) => {
          const proporcion = kmPico > 0 ? semana.totalKm / kmPico : 0;
          const esDescarga = semana.carga === 'descarga';
          const esActual = semana.id === semanaActualId;
          return (
            <div
              key={semana.id}
              className={cn(
                'flex-1 rounded-t-sm',
                esDescarga ? 'bg-zone-z1' : esActual ? 'bg-accent' : 'bg-zone-z2',
              )}
              style={{ height: `${Math.max(8, Math.round(proporcion * 100))}%` }}
            />
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <p className="u-sub">
          {semanas.length} semanas · {formatearFechaCorta(semanas[0]!.fechaInicio)}
        </p>
        <p className="u-data-sm text-fg-muted">{formatearKm(kmMesociclo)} km</p>
      </div>
    </button>
  );
}
