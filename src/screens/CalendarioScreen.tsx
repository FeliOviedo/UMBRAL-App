import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, SkipForward } from 'lucide-react';
import {
  aDiasDeDominio,
  listarSesiones,
  moverDiasDelPlan,
  reemplazarDiasDeSemana,
  type Sesion,
} from '@/data';
import {
  adaptarPorSesionOmitida,
  planearMovimiento,
  TRAINING_TYPE_TARGETS,
  type Adaptacion,
  type ResultadoMovimiento,
  type SemanaMovible,
} from '@/domain';
import type { TrainingType } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Cargando, ErrorMensaje } from '@/components/ui/feedback';
import { CHART, colorPorTipo, INTENSIDAD } from '@/lib/chart';
import { DIAS_SEMANA, formatearKm, hoyIso } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Calendario mensual: qué hiciste cada día y qué tenés por delante.
 *
 * Es un heatmap, así que el color codifica MAGNITUD con una rampa de un solo
 * hue (validada: hue spread 3°, luminosidad monótona). La identidad del tipo la
 * lleva la letra dentro de la celda, no el color — así ninguno de los dos
 * canales tiene que hacer los dos trabajos, y la escala sigue leyéndose bajo
 * cualquier tipo de daltonismo.
 *
 * Los días planificados pero no hechos se dibujan con el borde punteado: el
 * hueco es información.
 *
 * Además se puede REORGANIZAR el plan desde acá: arrastrar una sesión a otro
 * día la mueve, y si el destino está ocupado las dos se intercambian, así la
 * semana nunca cambia de carga por accidente. Quien decide si el movimiento es
 * legal es el dominio (`planearMovimiento`), no esta pantalla.
 */
export default function CalendarioScreen() {
  const usuario = useSession((s) => s.usuario);
  const plan = useSession((s) => s.plan);
  const recargarDatos = useSession((s) => s.recargarDatos);

  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mesOffset, setMesOffset] = useState(0);

  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<ResultadoMovimiento | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Saltear una sesión: el día elegido y lo que el motor propone hacer con la
  // semana que queda.
  const [salteo, setSalteo] = useState<{ diaId: string; adaptacion: Adaptacion } | null>(null);

  useEffect(() => {
    if (!usuario) return;
    listarSesiones(usuario.id)
      .then(setSesiones)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudieron cargar tus sesiones.'),
      );
  }, [usuario]);

  const hoy = hoyIso();
  const base = new Date(`${hoy}T00:00:00Z`);
  const mes = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + mesOffset, 1));

  /** El plan en la forma mínima que el dominio necesita para mover días. */
  const semanasMovibles: SemanaMovible[] = useMemo(
    () =>
      (plan?.semanas ?? []).map((s) => ({
        id: s.id,
        fechaInicio: s.fechaInicio,
        dias: s.dias.map((d) => ({
          id: d.id,
          semanaId: s.id,
          diaIndex: d.diaIndex,
          fecha: d.fecha,
          tipo: d.tipo,
        })),
      })),
    [plan],
  );

  const celdas = useMemo(() => {
    const anio = mes.getUTCFullYear();
    const mesNum = mes.getUTCMonth();
    const diasEnMes = new Date(Date.UTC(anio, mesNum + 1, 0)).getUTCDate();

    // El primer día del mes puede caer cualquier día: se rellena hasta el lunes.
    const primerDia = new Date(Date.UTC(anio, mesNum, 1)).getUTCDay();
    const huecosIniciales = primerDia === 0 ? 6 : primerDia - 1;

    const planPorFecha = new Map(
      (plan?.semanas ?? []).flatMap((s) => s.dias.map((d) => [d.fecha, d] as const)),
    );
    const sesionPorFecha = new Map<string, Sesion[]>();
    for (const s of sesiones ?? []) {
      const fecha = s.ocurrioEn.slice(0, 10);
      sesionPorFecha.set(fecha, [...(sesionPorFecha.get(fecha) ?? []), s]);
    }

    const resultado: ({ fecha: string; dia: number } | null)[] = Array.from(
      { length: huecosIniciales },
      () => null,
    );

    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = `${anio}-${String(mesNum + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      resultado.push({ fecha, dia: d });
    }

    return { celdas: resultado, planPorFecha, sesionPorFecha };
  }, [mes, plan, sesiones]);

  function alSoltar(fechaDestino: string) {
    setSobre(null);
    const diaId = arrastrando;
    setArrastrando(null);
    if (!diaId) return;

    const resultado = planearMovimiento(semanasMovibles, diaId, fechaDestino);
    if (!resultado) {
      setError('Esa fecha queda fuera del plan: no se puede mover la sesión ahí.');
      return;
    }
    // "Ya estaba ahí": no hay nada que confirmar ni que guardar.
    if (resultado.movimientos.length === 0) return;

    setError(null);
    setPropuesta(resultado);
  }

  /**
   * Saltear la sesión de un día.
   *
   * No se inventa nada acá: es el caso "sesión omitida" del motor de
   * adaptación, que reordena lo que queda de la semana usando los R como
   * comodines. El motor puede decir que no hay reordenamiento legal, y en ese
   * caso se muestra su explicación en lugar de forzar la semana.
   */
  function proponerSalteo(diaId: string) {
    const semana = plan?.semanas.find((s) => s.dias.some((d) => d.id === diaId));
    const dia = semana?.dias.find((d) => d.id === diaId);
    if (!semana || !dia) return;

    setError(null);
    setPropuesta(null);
    setSalteo({
      diaId,
      adaptacion: adaptarPorSesionOmitida(aDiasDeDominio(semana.dias), dia.diaIndex),
    });
  }

  async function confirmarSalteo() {
    if (!salteo || !usuario || !salteo.adaptacion.semanaPropuesta) return;
    const semana = plan?.semanas.find((s) => s.dias.some((d) => d.id === salteo.diaId));
    if (!semana) return;

    setGuardando(true);
    try {
      await reemplazarDiasDeSemana(usuario.id, semana.id, salteo.adaptacion.semanaPropuesta);
      await recargarDatos();
      setSalteo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo saltear la sesión.');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarMovimiento() {
    if (!propuesta) return;
    setGuardando(true);
    try {
      await moverDiasDelPlan(propuesta.movimientos, propuesta.semanasAfectadas);
      await recargarDatos();
      setPropuesta(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover la sesión.');
    } finally {
      setGuardando(false);
    }
  }

  // El error de carga inicial deja la pantalla sin nada que mostrar; los de
  // movimiento se muestran arriba del calendario, que sigue estando.
  if (error && sesiones === null) {
    return (
      <main className="u-page py-section">
        <ErrorMensaje mensaje={error} />
      </main>
    );
  }

  if (sesiones === null) return <Cargando mensaje="Cargando tu calendario…" />;

  const nombreMes = mes.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const delMes = (sesiones ?? []).filter((s) => {
    const f = new Date(`${s.ocurrioEn.slice(0, 10)}T00:00:00Z`);
    return f.getUTCFullYear() === mes.getUTCFullYear() && f.getUTCMonth() === mes.getUTCMonth();
  });
  const kmDelMes = delMes.reduce((sum, s) => sum + (s.distanciaMetros ?? 0), 0) / 1000;

  return (
    <main className="u-page flex flex-col gap-section pb-16 pt-8 lg:h-dvh lg:gap-6 lg:overflow-hidden lg:pb-6">
      <header>
        <span className="u-label">Calendario</span>
        <div className="mt-unit flex items-center justify-between gap-3">
          <h1 className="u-title first-letter:uppercase lg:text-hero">{nombreMes}</h1>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => setMesOffset((m) => m - 1)}
              className="p-2 text-outline hover:text-fg"
            >
              <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            </button>
            {/* Se puede navegar hacia adelante sin tope: el plan vive en el
                futuro, y antes el calendario no dejaba verlo. */}
            {mesOffset !== 0 && (
              <button
                type="button"
                onClick={() => setMesOffset(0)}
                className="u-label px-2 hover:text-fg"
              >
                Hoy
              </button>
            )}
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() => setMesOffset((m) => m + 1)}
              className="p-2 text-outline hover:text-fg"
            >
              <ChevronRight size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <p className="u-sub mt-2">
          {delMes.length} {delMes.length === 1 ? 'sesión' : 'sesiones'} ·{' '}
          {formatearKm(Math.round(kmDelMes))} km
        </p>
      </header>

      {error && <ErrorMensaje mensaje={error} />}

      {/* Confirmación del movimiento. Nunca se mueve nada en silencio, y si el
          movimiento rompe una regla se dice cuál ANTES de aplicarlo. */}
      {propuesta && (
        <section
          className={cn(
            'border p-4',
            propuesta.violaciones.length > 0 ? 'border-zone-z4' : 'border-accent',
          )}
        >
          <h2 className="u-label">
            {propuesta.violaciones.length > 0 ? 'Rompe una regla' : 'Confirmá el cambio'}
          </h2>
          <p className="u-sub mt-3 text-fg">{propuesta.mensaje}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={confirmarMovimiento} disabled={guardando}>
              {guardando ? 'Moviendo…' : propuesta.violaciones.length > 0 ? 'Mover igual' : 'Mover'}
            </Button>
            <Button variant="outline" onClick={() => setPropuesta(null)} disabled={guardando}>
              Cancelar
            </Button>
          </div>
        </section>
      )}

      {/*
        En desktop el mes entra ENTERO, sin scroll: la grilla toma la altura que
        queda de viewport y reparte seis filas iguales. Antes las celdas tenían
        proporción fija y la última semana del mes quedaba cortada abajo, que es
        justo la que uno mira cuando planifica.
        En móvil se mantiene la celda cuadrada y se scrollea: forzar seis filas
        en 844px de alto las dejaría ilegibles.
      */}
      {/* Saltear una sesión: se muestra qué va a pasar con el resto de la
          semana antes de tocar nada. Si el motor no encontró un reordenamiento
          legal, `aplicable` es false y sólo se explica. */}
      {salteo && (
        <section
          className={cn(
            'border p-4',
            salteo.adaptacion.aplicable ? 'border-accent' : 'border-zone-z4',
          )}
        >
          <h2 className="u-label">{salteo.adaptacion.titulo}</h2>
          <p className="u-sub mt-3 text-fg">{salteo.adaptacion.explicacion}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {salteo.adaptacion.aplicable && (
              <Button onClick={confirmarSalteo} disabled={guardando}>
                {guardando ? 'Salteando…' : 'Saltear y reordenar'}
              </Button>
            )}
            <Button variant="outline" onClick={() => setSalteo(null)} disabled={guardando}>
              {salteo.adaptacion.aplicable ? 'Cancelar' : 'Entendido'}
            </Button>
          </div>
        </section>
      )}

      <section className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="grid grid-cols-7 gap-1 lg:min-h-0 lg:flex-1 lg:grid-rows-[auto_repeat(6,minmax(0,1fr))] lg:gap-2">
          {DIAS_SEMANA.map((d) => (
            <span key={d} className="u-label pb-2 text-center text-[10px] lg:text-label">
              <span className="lg:hidden">{d.slice(0, 1)}</span>
              <span className="hidden lg:inline">{d.slice(0, 3)}</span>
            </span>
          ))}

          {celdas.celdas.map((celda, i) => {
            if (!celda) return <span key={`hueco-${i}`} aria-hidden />;

            const planificado = celdas.planPorFecha.get(celda.fecha);
            const hechas = celdas.sesionPorFecha.get(celda.fecha) ?? [];
            const tipo = (hechas[0]?.trainingType ?? planificado?.tipo ?? null) as
              | TrainingType
              | null;
            const seHizo = hechas.length > 0;
            const esFuturo = celda.fecha > hoy;
            const esHoy = celda.fecha === hoy;

            // Un día planificado que ya pasó y no se hizo: el hueco importa.
            const faltante =
              !seHizo && !esFuturo && planificado != null && planificado.tipo !== 'D';

            const km = hechas.reduce((s, x) => s + (x.distanciaMetros ?? 0), 0) / 1000;
            const etiqueta = [
              celda.fecha,
              tipo ? TRAINING_TYPE_TARGETS[tipo].label : 'Sin sesión',
              seHizo ? `${formatearKm(Math.round(km * 10) / 10)} km` : null,
              planificado && !seHizo && planificado.km > 0
                ? `${formatearKm(planificado.km)} km planificados`
                : null,
              faltante ? 'no realizada' : null,
            ]
              .filter(Boolean)
              .join(' · ');

            // Sólo se arrastra lo planificado que todavía no se hizo: mover una
            // sesión ya registrada sería reescribir la historia, no el plan.
            const movible = planificado != null && !seHizo;

            return (
              <div
                key={celda.fecha}
                title={etiqueta}
                aria-label={etiqueta}
                draggable={movible}
                onDragStart={() => movible && setArrastrando(planificado.id)}
                onDragEnd={() => {
                  setArrastrando(null);
                  setSobre(null);
                }}
                onDragOver={(e) => {
                  if (!arrastrando) return;
                  e.preventDefault();
                  setSobre(celda.fecha);
                }}
                onDragLeave={() => setSobre((f) => (f === celda.fecha ? null : f))}
                onDrop={(e) => {
                  e.preventDefault();
                  alSoltar(celda.fecha);
                }}
                className={cn(
                  'group relative flex aspect-square flex-col items-center justify-center gap-0.5 lg:aspect-auto lg:h-full',
                  faltante && 'border border-dashed border-zone-z4/50',
                  esHoy && 'ring-1 ring-accent',
                  movible && 'cursor-grab active:cursor-grabbing',
                  arrastrando === planificado?.id && 'opacity-40',
                  sobre === celda.fecha && 'ring-2 ring-accent',
                )}
                style={{
                  backgroundColor: seHizo ? colorPorTipo(tipo) : CHART.superficie,
                  // Lo futuro se atenúa, pero no tanto como antes: ahora es
                  // material con el que se interactúa, no sólo un anticipo.
                  opacity: esFuturo && sobre !== celda.fecha ? 0.55 : 1,
                }}
              >
                <span
                  className={cn(
                    'font-mono text-[10px] tabular-nums lg:text-data-sm',
                    seHizo && tipo === 'E' ? 'text-accent-foreground' : 'text-outline',
                  )}
                >
                  {celda.dia}
                </span>
                {tipo && tipo !== 'D' && (
                  <span
                    className={cn(
                      'font-mono text-[9px] font-bold lg:text-data-sm',
                      seHizo && tipo === 'E' ? 'text-accent-foreground' : 'text-fg',
                    )}
                  >
                    {tipo}
                  </span>
                )}
                {/* En desktop hay lugar para los km planificados. */}
                {planificado && !seHizo && planificado.km > 0 && (
                  <span className="hidden font-mono text-[10px] text-outline lg:block">
                    {formatearKm(planificado.km)} km
                  </span>
                )}
                {movible && (
                  <>
                    <GripVertical
                      size={12}
                      aria-hidden
                      className="absolute right-1 top-1 text-outline opacity-0 transition-opacity group-hover:opacity-100"
                    />
                    {/* Saltear sólo tiene sentido sobre una sesión real: un
                        Descanso no se saltea, ya es descanso. */}
                    {planificado.tipo !== 'D' && (
                      <button
                        type="button"
                        aria-label={`Saltear la sesión del ${celda.fecha}`}
                        title="Saltear esta sesión"
                        onClick={() => proponerSalteo(planificado.id)}
                        className="absolute bottom-1 right-1 p-1 text-outline opacity-0 transition-opacity hover:text-zone-z4 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <SkipForward size={12} strokeWidth={2} aria-hidden />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* La escala se explica: el color es intensidad, la letra es el tipo. */}
      <section>
        <h2 className="u-label">Cómo leerlo</h2>
        <div className="mt-3 flex items-center gap-2 lg:max-w-md">
          <span className="u-label">Suave</span>
          <div className="flex flex-1 gap-0.5">
            {INTENSIDAD.map((color) => (
              <span key={color} className="h-3 flex-1" style={{ backgroundColor: color }} />
            ))}
          </div>
          <span className="u-label">Duro</span>
        </div>
        <p className="u-sub mt-3">
          El color es la intensidad de la sesión; la letra dice de qué tipo fue. Los días con borde
          punteado estaban planificados y no se registraron.
        </p>
        {plan && (
          <p className="u-sub mt-2">
            Arrastrá una sesión planificada a otro día para moverla. Si el día destino ya tiene
            algo, las dos se intercambian, así la semana conserva la misma carga. Con el ícono de
            saltear la descartás, y el resto de la semana se reordena solo.
          </p>
        )}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {(['E', 'F', 'R', 'D'] as const).map((t) => (
            <li key={t} className="u-sub">
              <span className="font-mono text-fg">{t}</span> {TRAINING_TYPE_TARGETS[t].label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
