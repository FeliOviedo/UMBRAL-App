import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FastForward } from 'lucide-react';
import { aplicarSaltoDeMesociclo } from '@/data';
import { MESOCYCLE_SCHEMES, planearSaltoDeMesociclo, type SaltoDePlan } from '@/domain';
import type { LoadWeek } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { ErrorMensaje, Vacio } from '@/components/ui/feedback';
import { formatearFechaCorta, formatearKm, hoyIso, sumarDias } from '@/lib/format';
import { cn } from '@/lib/utils';

const ETIQUETA_CARGA: Record<LoadWeek, string> = {
  carga: 'Carga',
  'carga+': 'Carga +',
  'carga++': 'Carga ++',
  descarga: 'Descarga',
};

/**
 * Un mesociclo: sus semanas, cada una con su rol de carga y su volumen.
 *
 * Se puede recorrer el plan entero sin volver al índice: la cinta de arriba
 * lista todos los mesociclos y las flechas van al anterior y al siguiente.
 * Antes había que salir a `/plan` y entrar de nuevo para ver el de al lado, que
 * es justo lo que uno quiere hacer cuando está comparando cómo progresa la
 * carga.
 */
export default function MesocicloScreen() {
  const { index } = useParams<{ index: string }>();
  const navigate = useNavigate();
  const plan = useSession((s) => s.plan);
  const recargarDatos = useSession((s) => s.recargarDatos);

  const [salto, setSalto] = useState<SaltoDePlan | null>(null);
  const [saltando, setSaltando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mesocicloIndex = Number(index);
  const semanas = plan?.semanas.filter((s) => s.mesociclo === mesocicloIndex) ?? [];

  // Todos los mesociclos del plan, en orden, para la cinta de navegación.
  const indices = [...new Set((plan?.semanas ?? []).map((s) => s.mesociclo))].sort((a, b) => a - b);
  const posicion = indices.indexOf(mesocicloIndex);
  const anterior = posicion > 0 ? indices[posicion - 1]! : null;
  const siguiente = posicion >= 0 && posicion < indices.length - 1 ? indices[posicion + 1]! : null;

  if (!plan || semanas.length === 0) {
    return (
      <main className="u-page pb-16">
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

  // El plan en la forma mínima que el dominio necesita para adelantarlo.
  const semanasDelPlan = plan.semanas.map((s) => ({
    id: s.id,
    numero: s.numero,
    mesociclo: s.mesociclo,
    fechaInicio: s.fechaInicio,
    dias: s.dias.map((d) => ({ id: d.id, diaIndex: d.diaIndex })),
  }));
  const puedeSaltear = semanas.some((s) => s.fechaInicio > hoy);
  const esquema = MESOCYCLE_SCHEMES[plan.esquema];

  return (
    <main className="u-page pb-16">
      <header className="u-section">
        <div className="flex items-center justify-between gap-3">
          <p className="u-label">
            Mesociclo {mesocicloIndex} de {indices.length}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Mesociclo anterior"
              disabled={anterior === null}
              onClick={() => anterior !== null && navigate(`/plan/mesociclo/${anterior}`)}
              className="p-2 text-outline hover:text-fg disabled:opacity-30"
            >
              <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Mesociclo siguiente"
              disabled={siguiente === null}
              onClick={() => siguiente !== null && navigate(`/plan/mesociclo/${siguiente}`)}
              className="p-2 text-outline hover:text-fg disabled:opacity-30"
            >
              <ChevronRight size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

        <h1 className="mt-6 u-hero">
          {plan.esquema}
          <span className="ml-3 u-unit">{esquema.level}</span>
        </h1>
        <p className="u-sub mt-2">
          {semanas.length} semanas · {formatearFechaCorta(semanas[0]!.fechaInicio)} –{' '}
          {formatearFechaCorta(sumarDias(semanas[semanas.length - 1]!.fechaInicio, 6))}
        </p>
      </header>

      {/* Cinta con todos los mesociclos: saltar a cualquiera es un toque. */}
      {indices.length > 1 && (
        <nav aria-label="Mesociclos del plan" className="u-section">
          <ul className="flex flex-wrap gap-2">
            {indices.map((i) => {
              const suyas = plan.semanas.filter((s) => s.mesociclo === i);
              const esActual = i === mesocicloIndex;
              const tieneHoy = suyas.some(
                (s) => hoy >= s.fechaInicio && hoy <= sumarDias(s.fechaInicio, 6),
              );

              return (
                <li key={i}>
                  <Link
                    to={`/plan/mesociclo/${i}`}
                    aria-current={esActual ? 'page' : undefined}
                    className={cn(
                      'flex min-w-11 items-center justify-center border px-3 py-2 font-mono text-data-sm transition-colors',
                      esActual
                        ? 'border-accent bg-accent text-accent-foreground shadow-glow-soft'
                        : 'border-border text-fg-muted hover:border-outline hover:text-fg',
                      // El mesociclo en curso se marca aunque no sea el abierto.
                      !esActual && tieneHoy && 'border-accent-dim text-accent',
                    )}
                  >
                    M{i}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {error && <ErrorMensaje mensaje={error} className="u-section" />}

      {/* Adelantar: saltear lo que queda de este mesociclo. Sólo aparece si hay
          algo por saltear — si el mesociclo ya pasó entero, no hay nada que
          adelantar y el botón sería una mentira. */}
      {puedeSaltear && !salto && (
        <section className="u-section">
          <button
            type="button"
            onClick={() => {
              const propuesta = planearSaltoDeMesociclo(semanasDelPlan, mesocicloIndex, hoy);
              if (!propuesta) {
                setError('No queda ninguna semana de este mesociclo por empezar.');
                return;
              }
              setError(null);
              setSalto(propuesta);
            }}
            className="flex items-center gap-2 border border-border px-4 py-3 text-fg-muted transition-colors hover:border-outline hover:text-fg"
          >
            <FastForward size={16} strokeWidth={2} aria-hidden />
            <span className="font-mono text-label uppercase">Adelantar este mesociclo</span>
          </button>
        </section>
      )}

      {salto && (
        <section className="u-section border border-zone-z4 p-4">
          <h2 className="u-label">Adelantar salta carga</h2>
          <p className="u-sub mt-3 text-fg">{salto.mensaje}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={saltando}
              onClick={async () => {
                setSaltando(true);
                try {
                  await aplicarSaltoDeMesociclo(salto);
                  await recargarDatos();
                  setSalto(null);
                  navigate('/plan');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No se pudo adelantar el plan.');
                } finally {
                  setSaltando(false);
                }
              }}
            >
              {saltando ? 'Adelantando…' : 'Adelantar igual'}
            </Button>
            <Button variant="outline" disabled={saltando} onClick={() => setSalto(null)}>
              Cancelar
            </Button>
          </div>
        </section>
      )}

      <section className="u-section">
        <ol className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-5 lg:space-y-0">
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
                      <span
                        className={esActual ? 'u-data-sm text-accent' : 'u-data-sm text-fg-muted'}
                      >
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

      {/* Navegación de pie: al terminar de leer un mesociclo, el siguiente
          está ahí, sin volver a subir. */}
      <nav className="u-section flex items-center justify-between gap-3 border-t border-border pt-6">
        {anterior !== null ? (
          <Link to={`/plan/mesociclo/${anterior}`} className="u-label hover:text-fg">
            ← Mesociclo {anterior}
          </Link>
        ) : (
          <Link to="/plan" className="u-label hover:text-fg">
            ← Todo el plan
          </Link>
        )}
        {siguiente !== null && (
          <Link to={`/plan/mesociclo/${siguiente}`} className="u-label hover:text-fg">
            Mesociclo {siguiente} →
          </Link>
        )}
      </nav>
    </main>
  );
}
