import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listarSesiones, type DiaPlanificado, type Sesion } from '@/data';
import { TRAINING_TYPE_TARGETS } from '@/domain';
import type { LoadWeek, TrainingType } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Cargando, ErrorMensaje, Vacio } from '@/components/ui/feedback';
import { DIAS_SEMANA, formatearKm, hoyIso, sumarDias } from '@/lib/format';
import { cn } from '@/lib/utils';

const ETIQUETA_CARGA: Record<LoadWeek, string> = {
  carga: 'Carga',
  'carga+': 'Carga +',
  'carga++': 'Carga ++',
  descarga: 'Descarga',
};

const COLOR_TIPO: Record<TrainingType, string> = {
  F: 'border-l-accent',
  E: 'border-l-zone-z4',
  R: 'border-l-zone-z2',
  D: 'border-l-border',
};

/**
 * Microciclo: el selector de días de la semana y, debajo, la sesión del día
 * elegido. Es la pantalla que se usa entrenando, día a día.
 */
export default function SemanaScreen() {
  const { numero } = useParams<{ numero: string }>();
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);
  const plan = useSession((s) => s.plan);

  const weekNumber = Number(numero);
  const semana = plan?.semanas.find((s) => s.numero === weekNumber);

  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hoy = hoyIso();
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(hoy);

  useEffect(() => {
    if (!usuario || !semana) return;
    setSesiones(null);
    setError(null);
    listarSesiones(usuario.id, {
      desde: semana.fechaInicio,
      hasta: sumarDias(semana.fechaInicio, 6),
    })
      .then(setSesiones)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudieron cargar las sesiones.'));
  }, [usuario, semana]);

  useEffect(() => {
    if (!semana) return;
    const dentroDeLaSemana = hoy >= semana.fechaInicio && hoy <= sumarDias(semana.fechaInicio, 6);
    setDiaSeleccionado(dentroDeLaSemana ? hoy : semana.fechaInicio);
  }, [semana, hoy]);

  if (!plan || !semana) {
    return (
      <main className="mx-auto w-full max-w-md px-6 pb-16">
        <Vacio titulo="No encontramos esa semana">
          <Button asChild variant="outline" size="block" className="mt-6">
            <Link to="/plan">Volver al plan</Link>
          </Button>
        </Vacio>
      </main>
    );
  }

  const dia = semana.dias.find((d) => d.fecha === diaSeleccionado);
  const sesionDelDia = dia ? sesiones?.find((s) => s.planDayId === dia.id) : undefined;

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">Microciclo {semana.numero}</p>
        <div className="mt-6 flex items-baseline justify-between">
          <h1 className="u-hero">
            {formatearKm(semana.totalKm)}
            <span className="ml-2 font-sans text-base font-medium text-fg-muted">
              km · {ETIQUETA_CARGA[semana.carga]}
            </span>
          </h1>
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-sm bg-surface">
          <div className="h-full bg-accent" style={{ width: '100%' }} />
        </div>
      </header>

      <section className="border-t border-border pt-6">
        <div role="tablist" aria-label="Días de la semana" className="grid grid-cols-7 gap-1">
          {semana.dias.map((d, i) => {
            const seleccionado = d.fecha === diaSeleccionado;
            const esHoy = d.fecha === hoy;
            const tieneSesion = sesiones?.some((s) => s.planDayId === d.id) ?? false;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={seleccionado}
                onClick={() => setDiaSeleccionado(d.fecha)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-md py-2 transition-colors',
                  seleccionado ? 'bg-surface' : 'hover:bg-surface/50',
                )}
              >
                <span className="u-label">{DIAS_SEMANA[i]}</span>
                <span
                  className={cn(
                    'font-mono text-sm',
                    seleccionado ? 'text-accent' : esHoy ? 'text-fg' : 'text-fg-muted',
                  )}
                >
                  {Number(d.fecha.slice(-2))}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'h-1 w-1 rounded-full',
                    tieneSesion ? 'bg-accent' : 'bg-transparent',
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="u-section">
        {error && <ErrorMensaje mensaje={error} />}

        {dia && (
          <DetalleDelDia
            dia={dia}
            sesion={sesionDelDia}
            cargando={sesiones === null && !error}
            esPasado={dia.fecha < hoy}
            onRegistrar={() =>
              navigate(`/registrar?dia=${dia.id}&fecha=${dia.fecha}`)
            }
            onVerSesion={(id) => navigate(`/sesion/${id}`)}
          />
        )}
      </section>
    </main>
  );
}

function DetalleDelDia({
  dia,
  sesion,
  cargando,
  esPasado,
  onRegistrar,
  onVerSesion,
}: {
  dia: DiaPlanificado;
  sesion: Sesion | undefined;
  cargando: boolean;
  esPasado: boolean;
  onRegistrar: () => void;
  onVerSesion: (id: string) => void;
}) {
  if (cargando) return <Cargando mensaje="Cargando el día…" />;

  const objetivo = TRAINING_TYPE_TARGETS[dia.tipo];

  if (dia.tipo === 'D') {
    return (
      <div className={cn('border-l-2 pl-4', COLOR_TIPO.D)}>
        <p className="u-label">Descanso</p>
        <p className="mt-2 font-display text-lg text-fg-muted">Día de descanso pasivo.</p>
      </div>
    );
  }

  return (
    <div className={cn('border-l-2 pl-4', COLOR_TIPO[dia.tipo])}>
      <p className="u-label">{objetivo.label}</p>
      <h2 className="mt-2 font-hero text-hero-sm">
        {formatearKm(dia.km)}
        <span className="ml-2 font-sans text-base font-medium text-fg-muted">km</span>
      </h2>
      {(dia.zonaObjetivo || dia.rpeObjetivo) && (
        <p className="u-sub mt-2">
          {dia.zonaObjetivo && `Zona ${dia.zonaObjetivo}`}
          {dia.zonaObjetivo && dia.rpeObjetivo && ' · '}
          {dia.rpeObjetivo && `RPE ${dia.rpeObjetivo}`}
        </p>
      )}
      {dia.notas && <p className="u-sub mt-2">{dia.notas}</p>}

      {sesion ? (
        <Button variant="outline" size="block" className="mt-8" onClick={() => onVerSesion(sesion.id)}>
          Ver sesión registrada
        </Button>
      ) : (
        <Button size="block" className="mt-8" onClick={onRegistrar}>
          {esPasado ? 'Registrar esta sesión' : 'Registrar'}
        </Button>
      )}
    </div>
  );
}
