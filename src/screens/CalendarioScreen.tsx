import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { listarSesiones, type Sesion } from '@/data';
import { TRAINING_TYPE_TARGETS } from '@/domain';
import type { TrainingType } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Cargando, ErrorMensaje } from '@/components/ui/feedback';
import { CHART, colorPorTipo, INTENSIDAD } from '@/lib/chart';
import { DIAS_SEMANA, formatearKm, hoyIso } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Calendario mensual: qué hiciste cada día.
 *
 * Es un heatmap, así que el color codifica MAGNITUD con una rampa de un solo
 * hue (validada: hue spread 3°, luminosidad monótona). La identidad del tipo la
 * lleva la letra dentro de la celda, no el color — así ninguno de los dos
 * canales tiene que hacer los dos trabajos, y la escala sigue leyéndose bajo
 * cualquier tipo de daltonismo.
 *
 * Los días planificados pero no hechos se dibujan con el borde punteado: el
 * hueco es información.
 */
export default function CalendarioScreen() {
  const usuario = useSession((s) => s.usuario);
  const plan = useSession((s) => s.plan);

  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mesOffset, setMesOffset] = useState(0);

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

  if (error) {
    return (
      <main className="mx-auto w-full max-w-md px-edge py-section">
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
    <main className="mx-auto flex w-full max-w-md flex-col gap-section px-edge pb-16 pt-8">
      <header>
        <span className="u-label">Calendario</span>
        <div className="mt-unit flex items-center justify-between gap-3">
          <h1 className="u-title first-letter:uppercase">{nombreMes}</h1>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => setMesOffset((m) => m - 1)}
              className="p-2 text-outline hover:text-fg"
            >
              <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              disabled={mesOffset >= 0}
              onClick={() => setMesOffset((m) => m + 1)}
              className="p-2 text-outline hover:text-fg disabled:opacity-30"
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

      <section>
        <div className="grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((d) => (
            <span key={d} className="u-label pb-2 text-center text-[10px]">
              {d.slice(0, 1)}
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
              faltante ? 'no realizada' : null,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <div
                key={celda.fecha}
                title={etiqueta}
                aria-label={etiqueta}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-0.5',
                  faltante && 'border border-dashed border-zone-z4/50',
                  esHoy && 'ring-1 ring-accent',
                )}
                style={{
                  backgroundColor: seHizo ? colorPorTipo(tipo) : CHART.superficie,
                  opacity: esFuturo ? 0.35 : 1,
                }}
              >
                <span
                  className={cn(
                    'font-mono text-[10px] tabular-nums',
                    seHizo && tipo === 'E' ? 'text-accent-foreground' : 'text-outline',
                  )}
                >
                  {celda.dia}
                </span>
                {tipo && tipo !== 'D' && (
                  <span
                    className={cn(
                      'font-mono text-[9px] font-bold',
                      seHizo && tipo === 'E' ? 'text-accent-foreground' : 'text-fg',
                    )}
                  >
                    {tipo}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* La escala se explica: el color es intensidad, la letra es el tipo. */}
      <section>
        <h2 className="u-label">Cómo leerlo</h2>
        <div className="mt-3 flex items-center gap-2">
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
