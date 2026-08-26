import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { listarSesiones, type Sesion } from '@/data';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Cargando, ErrorMensaje, Vacio } from '@/components/ui/feedback';
import { CHART, EJE_PROPS, numero, regresionLineal, TOOLTIP_PROPS } from '@/lib/chart';
import { formatearKm, sumarDias } from '@/lib/format';

/**
 * Progreso de volumen: lo planificado contra lo realmente corrido.
 *
 * Dos magnitudes de la MISMA unidad (km), así que van en un solo eje. El área
 * es lo real y la línea punteada lo planificado; la tendencia es una tercera
 * lectura, no una serie más.
 *
 * Las semanas de descarga se marcan con un punto en lugar de con un color
 * distinto: el color ya está diciendo "km", y darle además el trabajo de decir
 * "esta semana es de descarga" lo sobrecargaría.
 */
export default function VolumenScreen() {
  const usuario = useSession((s) => s.usuario);
  const plan = useSession((s) => s.plan);

  const [sesiones, setSesiones] = useState<Sesion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    listarSesiones(usuario.id)
      .then(setSesiones)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudieron cargar tus sesiones.'),
      );
  }, [usuario]);

  const datos = useMemo(() => {
    if (!plan || !sesiones) return [];
    return plan.semanas.map((semana) => {
      const fin = sumarDias(semana.fechaInicio, 6);
      const reales = sesiones.filter((s) => {
        const fecha = s.ocurrioEn.slice(0, 10);
        return fecha >= semana.fechaInicio && fecha <= fin;
      });
      const km = reales.reduce((sum, s) => sum + (s.distanciaMetros ?? 0), 0) / 1000;
      return {
        semana: semana.numero,
        planificado: Math.round(semana.totalKm * 10) / 10,
        real: reales.length > 0 ? Math.round(km * 10) / 10 : null,
        esDescarga: semana.carga === 'descarga',
      };
    });
  }, [plan, sesiones]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-md px-edge py-section">
        <ErrorMensaje mensaje={error} />
      </main>
    );
  }

  if (sesiones === null) return <Cargando mensaje="Cargando tu volumen…" />;

  if (!plan) {
    return (
      <main className="mx-auto w-full max-w-md px-edge pb-16 pt-8">
        <Vacio titulo="Todavía no tenés un plan">
          <p>El progreso de volumen compara lo que corriste contra lo que estaba planificado.</p>
          <Button asChild size="block" className="mt-8">
            <Link to="/objetivo">Definir mi objetivo</Link>
          </Button>
        </Vacio>
      </main>
    );
  }

  const conDatos = datos.filter((d) => d.real !== null);
  const tendencia = regresionLineal(conDatos.map((d) => ({ x: d.semana, y: d.real! })));

  const kmTotales = conDatos.reduce((s, d) => s + (d.real ?? 0), 0);
  const kmPlanificadosHastaHoy = conDatos.reduce((s, d) => s + d.planificado, 0);
  const cumplimiento =
    kmPlanificadosHastaHoy > 0 ? Math.round((kmTotales / kmPlanificadosHastaHoy) * 100) : 0;

  const descargas = datos.filter((d) => d.esDescarga && d.real !== null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-block px-edge pb-16 pt-8">
      <header>
        <span className="u-label">Progreso de volumen</span>
        <h1 className="mt-unit u-hero">
          {formatearKm(Math.round(kmTotales))}
          <span className="ml-2 u-unit">km</span>
        </h1>
        <p className="u-sub mt-2">
          Acumulados en {conDatos.length} {conDatos.length === 1 ? 'semana' : 'semanas'} ·{' '}
          {cumplimiento}% de lo planificado
        </p>
      </header>

      {conDatos.length < 2 ? (
        <Vacio titulo="Falta historia">
          <p>Con un par de semanas registradas vas a poder ver la curva.</p>
        </Vacio>
      ) : (
        <>
          <section>
            <h2 className="u-label">Semana a semana</h2>
            <p className="u-sub mt-1">
              El área es lo que corriste; la línea punteada, lo planificado. Los puntos marcan las
              semanas de descarga.
            </p>

            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradVolumen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.acento} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART.acento} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="semana" {...EJE_PROPS} tickFormatter={(v: number) => `S${v}`} />
                  <YAxis {...EJE_PROPS} width={44} />
                  <Tooltip
                    {...TOOLTIP_PROPS}
                    formatter={(v, nombre) => [
                      v == null ? '—' : `${numero(v)} km`,
                      nombre === 'real' ? 'Corrido' : 'Planificado',
                    ]}
                    labelFormatter={(v) => `Semana ${numero(v)}`}
                  />

                  <Line
                    type="monotone"
                    dataKey="planificado"
                    stroke={CHART.contexto}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="real"
                    stroke={CHART.acento}
                    strokeWidth={2}
                    fill="url(#gradVolumen)"
                    connectNulls={false}
                    dot={false}
                  />

                  {/* Marcas de descarga: un punto, no un color. */}
                  {descargas.map((d) => (
                    <ReferenceDot
                      key={d.semana}
                      x={d.semana}
                      y={d.real!}
                      r={5}
                      fill={CHART.fondo}
                      stroke={CHART.acento}
                      strokeWidth={2}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <Leyenda color={CHART.acento} texto="Corrido" />
              <Leyenda color={CHART.contexto} texto="Planificado" punteada />
              <Leyenda color={CHART.acento} texto="Semana de descarga" anillo />
            </div>
          </section>

          {tendencia && (
            <section>
              <h2 className="u-label">Tendencia</h2>
              <p className="u-sub mt-2 leading-relaxed">
                {tendencia.m > 0.2
                  ? `Venís sumando alrededor de ${formatearKm(Math.round(tendencia.m * 10) / 10)} km por semana. ` +
                    'Es la progresión que el plan busca: subir despacio y sostenido.'
                  : tendencia.m < -0.2
                    ? `Tu volumen viene bajando alrededor de ${formatearKm(Math.abs(Math.round(tendencia.m * 10) / 10))} km por semana. ` +
                      'Si no estás en una fase de descarga o de recuperación, conviene mirar qué está pasando.'
                    : 'Tu volumen se mantiene parejo. En una fase de mantenimiento está bien; si esperabas ' +
                      'estar subiendo, revisá si estás cumpliendo las semanas de carga.'}
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Leyenda({
  color,
  texto,
  punteada = false,
  anillo = false,
}: {
  color: string;
  texto: string;
  punteada?: boolean;
  anillo?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      {anillo ? (
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-full border-2"
          style={{ borderColor: color, backgroundColor: CHART.fondo }}
        />
      ) : (
        <span
          aria-hidden
          className="h-0.5 w-4"
          style={{
            backgroundColor: punteada ? 'transparent' : color,
            backgroundImage: punteada
              ? `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 8px)`
              : undefined,
          }}
        />
      )}
      <span className="u-label">{texto}</span>
    </span>
  );
}
