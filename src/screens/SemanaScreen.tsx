import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bed, ChevronLeft, ChevronRight, Gauge } from 'lucide-react';
import {
  aDiasDeDominio,
  guardarPropuesta,
  listarSesiones,
  type DiaPlanificado,
  type Sesion,
} from '@/data';
import { adaptarPorSesionOmitida, TRAINING_TYPE_TARGETS, zonaPorId } from '@/domain';
import type { LoadWeek, TrainingType } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import DetalleDia from '@/components/DetalleDia';
import { Cargando, ErrorMensaje, Vacio } from '@/components/ui/feedback';
import { formatearKm, hoyIso, sumarDias } from '@/lib/format';
import { cn } from '@/lib/utils';

const ETIQUETA_CARGA: Record<LoadWeek, string> = {
  carga: 'Carga',
  'carga+': 'Carga +',
  'carga++': 'Carga ++',
  descarga: 'Descarga',
};

/**
 * Color del tipo de sesión: la barra vertical de la izquierda y el badge.
 *
 * Stitch le da el lima sólo al Específico —la sesión dura— y teal al resto.
 * Es la regla de "un acento por vez": si todos los días fueran lima, ninguno
 * destacaría.
 */
const ESTILO_TIPO: Record<TrainingType, { barra: string; badge: string; texto: string }> = {
  F: { barra: 'bg-accent', badge: 'bg-accent text-accent-foreground', texto: 'text-accent' },
  E: { barra: 'bg-accent', badge: 'bg-accent text-accent-foreground', texto: 'text-accent' },
  R: {
    barra: 'bg-zone-z2',
    badge: 'bg-zone-z2/20 text-zone-z2 border border-zone-z2/50',
    texto: 'text-zone-z2',
  },
  D: { barra: 'bg-transparent', badge: '', texto: 'text-outline' },
};

// Iniciales de los días, como en el selector de Stitch.
const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

/**
 * Microciclo: cabecera con el volumen de la semana, selector de días y la
 * lista de sesiones.
 *
 * Composición tomada de `design-reference/esta_semana_minimalista`: las
 * sesiones NO son tarjetas — son filas con `border-b` y una barra de acento de
 * 4px a la izquierda. Se muestran los siete días de una, no sólo el elegido:
 * la pantalla sirve para ver la semana completa, y el día seleccionado sólo se
 * resalta.
 */
export default function SemanaScreen() {
  const { numero } = useParams<{ numero: string }>();
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);
  const plan = useSession((s) => s.plan);

  const semana = plan?.semanas.find((s) => s.numero === Number(numero));
  const numerosOrdenados = [...(plan?.semanas ?? [])].map((s) => s.numero).sort((a, b) => a - b);
  const posicion = numerosOrdenados.indexOf(Number(numero));
  const semanaAnterior = posicion > 0 ? numerosOrdenados[posicion - 1]! : null;
  const semanaSiguiente =
    posicion >= 0 && posicion < numerosOrdenados.length - 1 ? numerosOrdenados[posicion + 1]! : null;

  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [omitiendo, setOmitiendo] = useState(false);
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
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las sesiones.'),
      );
  }, [usuario, semana]);

  useEffect(() => {
    if (!semana) return;
    const dentro = hoy >= semana.fechaInicio && hoy <= sumarDias(semana.fechaInicio, 6);
    setDiaSeleccionado(dentro ? hoy : semana.fechaInicio);
  }, [semana, hoy]);

  if (!plan || !semana) {
    return (
      <main className="u-page pb-16">
        <Vacio titulo="No encontramos esa semana">
          <Button asChild variant="outline" size="block" className="mt-6">
            <Link to="/plan">Volver al plan</Link>
          </Button>
        </Vacio>
      </main>
    );
  }

  /**
   * "No la hice": el motor reordena lo que queda de la semana y deja la
   * propuesta para que el usuario la revise antes de aplicarla.
   */
  async function omitirSesion(dia: DiaPlanificado) {
    if (!usuario || !semana) return;
    setOmitiendo(true);
    setError(null);
    try {
      const dias = aDiasDeDominio(semana.dias);
      const adaptacion = adaptarPorSesionOmitida(dias, dia.diaIndex);
      await guardarPropuesta(usuario.id, adaptacion, {
        planWeekId: semana.id,
        semanaOriginal: dias,
      });
      navigate('/ajustes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la sesión omitida.');
      setOmitiendo(false);
    }
  }

  const diaParaPanel = semana.dias.find((d) => d.fecha === diaSeleccionado) ?? null;

  const kmReales =
    (sesiones?.reduce((sum, s) => sum + (s.distanciaMetros ?? 0), 0) ?? 0) / 1000;
  const progreso = semana.totalKm > 0 ? Math.min(1, kmReales / semana.totalKm) : 0;

  return (
    <main className="u-page flex flex-col gap-section pb-16 pt-6">
      {/* Cabecera: nombre a la izquierda, volumen en hero a la derecha. */}
      <section className="flex flex-col gap-unit">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Semana anterior"
                disabled={semanaAnterior === null}
                onClick={() => semanaAnterior !== null && navigate(`/plan/semana/${semanaAnterior}`)}
                className="-ml-2 p-2 text-outline hover:text-fg disabled:opacity-30"
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden />
              </button>
              <h1 className="u-title">Microciclo {semana.numero}</h1>
              <button
                type="button"
                aria-label="Semana siguiente"
                disabled={semanaSiguiente === null}
                onClick={() => semanaSiguiente !== null && navigate(`/plan/semana/${semanaSiguiente}`)}
                className="p-2 text-outline hover:text-fg disabled:opacity-30"
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <p className="u-label ml-1 mt-1">{ETIQUETA_CARGA[semana.carga]}</p>
          </div>
          <div className="u-hero-lg leading-none text-accent">
            {Math.round(kmReales)}
            <span className="u-unit">/{formatearKm(semana.totalKm)}km</span>
          </div>
        </div>
        <div className="u-bar">
          <div className="u-bar-fill" style={{ width: `${Math.round(progreso * 100)}%` }} />
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
      <div>
      {/* Selector de días: iniciales arriba, número abajo, subrayado en el actual. */}
      <section className="w-full border-b border-border pb-4">
        <div role="tablist" aria-label="Días de la semana" className="flex justify-between p-1.5">
          {semana.dias.map((d, i) => {
            const seleccionado = d.fecha === diaSeleccionado;
            const tieneSesion = sesiones?.some((s) => s.planDayId === d.id) ?? false;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={seleccionado}
                onClick={() => setDiaSeleccionado(d.fecha)}
                className={cn(
                  'flex w-[13%] flex-col items-center justify-center py-1.5 transition-colors',
                  seleccionado
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-outline hover:bg-surface',
                )}
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]">
                  {INICIALES[i]}
                </span>
                <span className="mt-1 font-mono text-[13px] font-medium tabular-nums">
                  {Number(d.fecha.slice(-2))}
                </span>
                <span
                  aria-hidden
                  className={cn('mt-1 h-1 w-1', tieneSesion ? 'bg-accent' : 'bg-transparent')}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* Las siete sesiones de la semana. */}
      <section className="flex flex-col">
        {error && <ErrorMensaje mensaje={error} />}
        {sesiones === null && !error ? (
          <Cargando mensaje="Cargando la semana…" />
        ) : (
          semana.dias.map((dia) => (
            <FilaDeSesion
              key={dia.id}
              dia={dia}
              sesion={sesiones?.find((s) => s.planDayId === dia.id)}
              seleccionado={dia.fecha === diaSeleccionado}
              onAbrir={() => {
                const sesion = sesiones?.find((s) => s.planDayId === dia.id);
                if (sesion) navigate(`/sesion/${sesion.id}`);
                else if (dia.tipo !== 'D') navigate(`/registrar?dia=${dia.id}&fecha=${dia.fecha}`);
              }}
              onOmitir={
                dia.tipo !== 'D' && !sesiones?.some((s) => s.planDayId === dia.id) && !omitiendo
                  ? () => void omitirSesion(dia)
                  : undefined
              }
            />
          ))
        )}
      </section>
      </div>

      {/* Panel de detalle: sólo en desktop, del día que está elegido en el
          selector de arriba. En móvil la fila ya cumple ese rol. */}
      {diaParaPanel && (
        <section className="mt-section hidden lg:mt-0 lg:block">
          <DetalleDia
            dia={diaParaPanel}
            sesion={sesiones?.find((s) => s.planDayId === diaParaPanel.id)}
            onVer={() => {
              const sesion = sesiones?.find((s) => s.planDayId === diaParaPanel.id);
              if (sesion) navigate(`/sesion/${sesion.id}`);
              else if (diaParaPanel.tipo !== 'D') {
                navigate(`/registrar?dia=${diaParaPanel.id}&fecha=${diaParaPanel.fecha}`);
              }
            }}
            onOmitir={
              diaParaPanel.tipo !== 'D' &&
              !sesiones?.some((s) => s.planDayId === diaParaPanel.id) &&
              !omitiendo
                ? () => void omitirSesion(diaParaPanel)
                : undefined
            }
          />
        </section>
      )}
      </div>
    </main>
  );
}

function FilaDeSesion({
  dia,
  sesion,
  seleccionado,
  onAbrir,
  onOmitir,
}: {
  dia: DiaPlanificado;
  sesion: Sesion | undefined;
  seleccionado: boolean;
  onAbrir: () => void;
  onOmitir?: (() => void) | undefined;
}) {
  const estilo = ESTILO_TIPO[dia.tipo];
  const objetivo = TRAINING_TYPE_TARGETS[dia.tipo];

  if (dia.tipo === 'D') {
    return (
      <div
        className={cn(
          'flex flex-col justify-center gap-2 border-b border-border py-4',
          seleccionado ? 'opacity-100' : 'opacity-60',
        )}
      >
        <div className="flex items-center gap-2">
          <Bed size={18} strokeWidth={2} className="text-outline" aria-hidden />
          <span className="u-label tracking-widest">Descanso total</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden border-b border-border py-4',
        !seleccionado && 'opacity-70',
      )}
    >
      {/* Barra de acento vertical: 4px, con halo cuando es la sesión dura. */}
      <span
        aria-hidden
        className={cn(
          'absolute bottom-0 left-0 top-0 w-1',
          estilo.barra,
          dia.tipo === 'E' && 'shadow-glow',
        )}
      />
      <div className="flex w-full flex-col gap-1 pl-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center font-mono text-[10px] font-bold',
                estilo.badge,
              )}
            >
              {dia.tipo}
            </span>
            <span
              className={cn(
                'font-mono text-[10px] font-semibold uppercase tracking-wider',
                estilo.texto,
              )}
            >
              {objetivo.label}
            </span>
            {sesion && <span className="u-label text-outline">· Registrada</span>}
          </div>

          {/*
            Va fuera del botón principal, no anidado: dos botones uno dentro de
            otro no son HTML válido y rompen la navegación por teclado.
          */}
          {onOmitir && (
            <button
              type="button"
              onClick={onOmitir}
              className="font-mono text-[10px] uppercase tracking-widest text-outline hover:text-zone-z4"
            >
              No la hice
            </button>
          )}
        </div>

        <button type="button" onClick={onAbrir} className="w-full text-left">
          {/*
            Stitch le pone a cada sesión un nombre descriptivo ("Intervalos de
            Umbral", "Rodaje Suave"). El dominio no genera nombres, pero el de la
            zona objetivo dice exactamente lo mismo y sale de la metodología en
            lugar de inventarse.

            La cifra grande: en Stitch son minutos, porque su plan está en
            minutos. Umbral planifica en KM, así que van los km — mismo lugar y
            mismo peso visual, con el dato que el dominio realmente produce.
          */}
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <h3 className="u-title-sm leading-tight">
              {dia.zonaObjetivo ? zonaPorId(dia.zonaObjetivo).name : objetivo.label}
            </h3>
            <div className="u-hero-sm text-right leading-none">
              {formatearKm(sesion?.distanciaMetros != null ? sesion.distanciaMetros / 1000 : dia.km)}
              <span className="font-title text-[20px] text-outline">km</span>
            </div>
          </div>

          {(dia.zonaObjetivo || dia.rpeObjetivo) && (
            <div className="mt-1 flex items-center gap-1.5">
              <Gauge size={16} strokeWidth={2} className="text-outline" aria-hidden />
              <span className={cn('font-mono text-[14px]', estilo.texto)}>
                {dia.zonaObjetivo && `Zona ${dia.zonaObjetivo}`}
                {dia.zonaObjetivo && dia.rpeObjetivo && ' · '}
                {dia.rpeObjetivo && `RPE ${dia.rpeObjetivo}`}
              </span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
