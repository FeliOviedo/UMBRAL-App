import { Link, useNavigate, useParams } from 'react-router-dom';
import { MESOCYCLE_SCHEMES } from '@/domain';
import type { LoadWeek } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Vacio } from '@/components/ui/feedback';
import { formatearFechaCorta, formatearKm, hoyIso, sumarDias } from '@/lib/format';
import { cn } from '@/lib/utils';

const ETIQUETA_CARGA: Record<LoadWeek, string> = {
  carga: 'Carga',
  'carga+': 'Carga +',
  'carga++': 'Carga ++',
  descarga: 'Descarga',
};

/** Un mesociclo: sus semanas, cada una con su rol de carga y su volumen. */
export default function MesocicloScreen() {
  const { index } = useParams<{ index: string }>();
  const navigate = useNavigate();
  const plan = useSession((s) => s.plan);

  const mesocicloIndex = Number(index);
  const semanas = plan?.semanas.filter((s) => s.mesociclo === mesocicloIndex) ?? [];

  if (!plan || semanas.length === 0) {
    return (
      <main className="mx-auto w-full max-w-md px-6 pb-16">
        <Vacio titulo="No encontramos ese mesociclo">
          <Button asChild variant="outline" size="block" className="mt-6">
            <Link to="/plan">Volver al plan</Link>
          </Button>
        </Vacio>
      </main>
    );
  }

  const hoy = hoyIso();
  const kmPico = Math.max(...semanas.map((s) => s.totalKm), 0);
  const esquema = MESOCYCLE_SCHEMES[plan.esquema];

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">Mesociclo {mesocicloIndex}</p>
        <h1 className="mt-6 u-hero">
          {plan.esquema}
          <span className="ml-3 font-sans text-base font-medium text-fg-muted">
            {esquema.level}
          </span>
        </h1>
        <p className="u-sub mt-2">
          {semanas.length} semanas · {formatearFechaCorta(semanas[0]!.fechaInicio)} –{' '}
          {formatearFechaCorta(sumarDias(semanas[semanas.length - 1]!.fechaInicio, 6))}
        </p>
      </header>

      <section className="u-section border-t border-border">
        <ol className="space-y-5">
          {semanas.map((semana) => {
            const proporcion = kmPico > 0 ? semana.totalKm / kmPico : 0;
            const esDescarga = semana.carga === 'descarga';
            const esActual = hoy >= semana.fechaInicio && hoy <= sumarDias(semana.fechaInicio, 6);

            return (
              <li key={semana.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/plan/semana/${semana.numero}`)}
                  className="w-full text-left"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-3">
                      <span className={esActual ? 'u-table text-accent' : 'u-table text-fg-muted'}>
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
          })}
        </ol>
      </section>
    </main>
  );
}

