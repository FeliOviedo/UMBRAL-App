import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { listarSesiones, type Sesion } from '@/data';
import {
  cajaNegra,
  estadoSupercompensacion,
  explicarEstado,
  serieDeBalance,
  type SesionAnalizable,
} from '@/domain';
import { useSession } from '@/store/session.store';
import { useTheme } from '@/store/theme.store';
import { Button } from '@/components/ui/button';
import { Cargando, ErrorMensaje, Vacio } from '@/components/ui/feedback';
import { chartTokens, ejeProps, numero, regresionLineal, tooltipProps, type Tema } from '@/lib/chart';
import { formatearPaceCorto } from '@/lib/format';

/**
 * Caja Negra: entra entrenamiento, sale adaptación.
 *
 * Lo único observable desde afuera es la relación entre esfuerzo y resultado.
 * Por eso el gráfico principal es Pace vs RPE y el de FC va abajo, marcado como
 * secundario: no es una elección estética, es la jerarquía de la metodología
 * hecha visible.
 *
 * Todos los gráficos son de UNA serie o de emphasis (una serie protagonista +
 * el resto en gris). No hay ninguno con dos ejes Y: cuando hay dos magnitudes
 * distintas, son dos gráficos.
 */
export default function CajaNegraScreen() {
  const usuario = useSession((s) => s.usuario);
  const umbral = useSession((s) => s.umbral);
  const perfil = useSession((s) => s.perfil);
  const tema = useTheme((s) => s.tema);
  const chart = chartTokens(tema);

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

  const analizables = useMemo<SesionAnalizable[]>(() => {
    if (!sesiones) return [];
    const ahora = Date.now();
    return sesiones.map((s) => ({
      diasAtras: Math.floor((ahora - Date.parse(s.ocurrioEn)) / 86_400_000),
      paceSecPerKm: s.paceSegPorKm,
      rpe: s.rpe,
      fcPromedio: s.fcPromedio,
      cargaMetabolica: s.cargaMetabolica ?? 0,
    }));
  }, [sesiones]);

  /**
   * Pace de referencia: el habitual de rodaje. Se toma la mediana de los paces
   * registrados, que resiste mejor que el promedio a una carrera suelta o a un
   * día de intervalos.
   */
  const paceReferencia = useMemo(() => {
    const paces = analizables
      .map((s) => s.paceSecPerKm)
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b);
    if (paces.length === 0) return umbral?.pacePorKm ?? null;
    return paces[Math.floor(paces.length / 2)]!;
  }, [analizables, umbral]);

  if (error) {
    return (
      <main className="u-page py-section">
        <ErrorMensaje mensaje={error} />
      </main>
    );
  }

  if (sesiones === null) return <Cargando mensaje="Analizando tus sesiones…" />;

  if (sesiones.length < 3) {
    return (
      <main className="u-page pb-16 pt-8">
        <Vacio titulo="Todavía no hay suficiente historia">
          <p>
            La Caja Negra compara tus sesiones entre sí para ver si el mismo ritmo te va costando
            menos. Con unas cuantas salidas más va a tener algo que decir.
          </p>
          <Button asChild size="block" className="mt-8">
            <Link to="/registrar">Registrar una sesión</Link>
          </Button>
        </Vacio>
      </main>
    );
  }

  const veredicto = paceReferencia !== null ? cajaNegra(analizables, paceReferencia) : null;
  const homeostasis = estadoSupercompensacion(analizables);
  const estado = explicarEstado(homeostasis.estado);

  return (
    <main className="u-page flex flex-col gap-block pb-16 pt-8">
      <header>
        <span className="u-label">Caja negra</span>
        <h1 className="u-title mt-unit">
          {veredicto?.veredicto === 'progreso'
            ? 'Estás progresando'
            : veredicto?.veredicto === 'retroceso'
              ? 'Algo se puso cuesta arriba'
              : veredicto?.veredicto === 'estable'
                ? 'Te estás sosteniendo'
                : 'Sin datos suficientes'}
        </h1>
        {veredicto && <p className="u-sub mt-3 leading-relaxed">{veredicto.mensaje}</p>}
      </header>

      {/* ── Pace vs RPE: EL gráfico. ─────────────────────────────────────── */}
      {paceReferencia !== null && (
        <DispersionEsfuerzo
          tema={tema}
          titulo="Esfuerzo a lo largo del tiempo"
          subtitulo="Cuánto te costó cada sesión, al ritmo que corriste. Si la línea baja, estás mejorando."
          datos={analizables
            .filter((s) => s.paceSecPerKm !== null && s.rpe < 9)
            .map((s) => ({ x: s.diasAtras, y: s.rpe, pace: s.paceSecPerKm! }))}
          etiquetaY="RPE"
          dominioY={[1, 10]}
          principal
        />
      )}

      {/* ── Pace vs FC: secundario, y se dice por qué. ───────────────────── */}
      {analizables.some((s) => s.fcPromedio !== null) && (
        <DispersionEsfuerzo
          tema={tema}
          titulo="Frecuencia cardíaca"
          subtitulo="Dato de apoyo. Sólo confía en esta curva si tu reloj te da números coherentes: si contradice al RPE de arriba, gana el RPE."
          datos={analizables
            .filter((s) => s.fcPromedio !== null)
            .map((s) => ({ x: s.diasAtras, y: s.fcPromedio!, pace: s.paceSecPerKm ?? 0 }))}
          etiquetaY="ppm"
          secundario
        />
      )}

      {/* ── Curva de supercompensación ───────────────────────────────────── */}
      <section>
        <h2 className="u-label">Curva de supercompensación</h2>
        <p className="u-sub mt-1">
          Por debajo de la línea estás acumulando fatiga; por encima, rindiendo sobre tu base.
        </p>
        <div className="mt-4 h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={serieDeBalance(analizables).map((p) => ({
                dias: -p.diasAtras,
                balance: Math.round(p.balanceNormalizado * 100) / 100,
              }))}
              margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chart.acento} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chart.acento} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chart.grid} vertical={false} />
              <XAxis
                dataKey="dias"
                {...ejeProps(tema)}
                tickFormatter={(v: number) => (v === 0 ? 'hoy' : `${v}d`)}
              />
              <YAxis {...ejeProps(tema)} width={44} />
              <ReferenceLine y={0} stroke={chart.axis} strokeDasharray="3 3" />
              <Tooltip
                {...tooltipProps(tema)}
                formatter={(v) => [numero(v), 'Balance']}
                labelFormatter={(v) => (numero(v) === 0 ? 'Hoy' : `Hace ${-numero(v)} días`)}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={chart.acento}
                strokeWidth={2}
                fill="url(#gradBalance)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4">
          <p className="u-data">{estado.titulo}</p>
          <p className="u-sub mt-1">{estado.detalle}</p>
        </div>
      </section>

      {/* ── Producción de energía ────────────────────────────────────────── */}
      <ProduccionDeEnergia sesiones={analizables} tema={tema} />

      {/* ── Volumen vs rendimiento ───────────────────────────────────────── */}
      <VolumenVsRendimiento sesiones={analizables} tema={tema} />

      <section className="flex flex-col gap-3">
        <Button asChild variant="outline" size="block">
          <Link to="/volumen">Progreso de volumen</Link>
        </Button>
        <Button asChild variant="outline" size="block">
          <Link to="/calendario">Calendario</Link>
        </Button>
      </section>

      {!perfil?.ritmoBase && (
        <p className="u-sub">
          Completá tu ritmo base en el perfil para que las comparaciones usen tu referencia real.
        </p>
      )}
    </main>
  );
}

/**
 * Dispersión de esfuerzo contra el tiempo, con su recta de tendencia.
 *
 * El eje X son días hacia atrás, invertido para que el tiempo corra de
 * izquierda a derecha como en cualquier otro gráfico. Una sola serie: los
 * puntos son el dato y la recta es la lectura.
 */
function DispersionEsfuerzo({
  tema,
  titulo,
  subtitulo,
  datos,
  etiquetaY,
  dominioY,
  principal = false,
  secundario = false,
}: {
  tema: Tema;
  titulo: string;
  subtitulo: string;
  datos: { x: number; y: number; pace: number }[];
  etiquetaY: string;
  dominioY?: [number, number];
  principal?: boolean;
  secundario?: boolean;
}) {
  if (datos.length < 3) return null;

  const chart = chartTokens(tema);
  const color = secundario ? chart.contexto : chart.acento;
  const tendencia = regresionLineal(datos);

  // La recta se dibuja de extremo a extremo del rango observado.
  const xs = datos.map((d) => d.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const lineaTendencia = tendencia
    ? [
        { x: xMin, y: tendencia.m * xMin + tendencia.b },
        { x: xMax, y: tendencia.m * xMax + tendencia.b },
      ]
    : [];

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="u-label">{titulo}</h2>
        {tendencia && (
          <span className="u-label shrink-0">r² {tendencia.r2.toFixed(2)}</span>
        )}
      </div>
      <p className="u-sub mt-1">{subtitulo}</p>

      <div className={principal ? 'mt-4 h-64 w-full' : 'mt-4 h-48 w-full'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              reversed
              domain={['dataMin', 'dataMax']}
              {...ejeProps(tema)}
              tickFormatter={(v: number) => (v === 0 ? 'hoy' : `${v}d`)}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={dominioY ?? ['dataMin - 5', 'dataMax + 5']}
              {...ejeProps(tema)}
              // Las pulsaciones son de tres dígitos y el dominio es angosto: sin
              // ancho suficiente y sin forzar enteros, Recharts repite el mismo
              // tick redondeado y además lo recorta.
              width={52}
              allowDecimals={false}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <Tooltip
              {...tooltipProps(tema)}
              cursor={{ stroke: chart.axis, strokeDasharray: '3 3' }}
              formatter={(valor, nombre) =>
                nombre === 'pace'
                  ? [`${formatearPaceCorto(numero(valor))}/km`, 'Pace']
                  : [numero(valor), etiquetaY]
              }
              labelFormatter={() => ''}
            />
            {tendencia && (
              <Line
                data={lineaTendencia}
                dataKey="y"
                stroke={color}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
                legendType="none"
              />
            )}
            <Scatter data={datos} dataKey="y" fill={color} r={4} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/**
 * Producción de energía: carga metabólica por semana.
 *
 * Es magnitud en el tiempo, así que va como área de una sola serie. La lectura
 * es la forma de la curva —dónde acumulaste y dónde aflojaste—, no los valores
 * absolutos, que dependen de cuán bien calibrado tengas el RPE.
 */
function ProduccionDeEnergia({
  sesiones,
  tema,
}: {
  sesiones: readonly SesionAnalizable[];
  tema: Tema;
}) {
  const chart = chartTokens(tema);
  const porSemana = useMemo(() => {
    const semanas = new Map<number, number>();
    for (const s of sesiones) {
      if (s.diasAtras < 0 || s.diasAtras > 84) continue;
      const semana = Math.floor(s.diasAtras / 7);
      semanas.set(semana, (semanas.get(semana) ?? 0) + s.cargaMetabolica);
    }
    return [...semanas.entries()]
      .sort(([a], [b]) => b - a)
      .map(([semana, carga]) => ({ semana: -semana, carga: Math.round(carga) }));
  }, [sesiones]);

  if (porSemana.length < 2) return null;

  return (
    <section>
      <h2 className="u-label">Producción de energía</h2>
      <p className="u-sub mt-1">
        Carga metabólica por semana. Cuenta todo lo que hiciste, corras o no.
      </p>
      <div className="mt-4 h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={porSemana} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gradEnergia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chart.acentoDim} stopOpacity={0.4} />
                <stop offset="100%" stopColor={chart.acentoDim} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis
              dataKey="semana"
              {...ejeProps(tema)}
              tickFormatter={(v: number) => (v === 0 ? 'esta' : `${v}`)}
            />
            <YAxis {...ejeProps(tema)} width={44} />
            <Tooltip
              {...tooltipProps(tema)}
              formatter={(v) => [numero(v), 'Carga']}
              labelFormatter={(v) => (numero(v) === 0 ? 'Esta semana' : `Hace ${-numero(v)} semanas`)}
            />
            <Area
              type="monotone"
              dataKey="carga"
              stroke={chart.acentoDim}
              strokeWidth={2}
              fill="url(#gradEnergia)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/**
 * Volumen semanal contra el esfuerzo medio de esa semana.
 *
 * La pregunta que responde: ¿podés sostener más volumen sin que te cueste más?
 * Si los puntos de la derecha (más km) no están más arriba (más RPE), la
 * respuesta es que sí.
 */
function VolumenVsRendimiento({
  sesiones,
  tema,
}: {
  sesiones: readonly SesionAnalizable[];
  tema: Tema;
}) {
  const chart = chartTokens(tema);
  const puntos = useMemo(() => {
    const semanas = new Map<number, { carga: number; rpes: number[] }>();
    for (const s of sesiones) {
      if (s.diasAtras < 0 || s.diasAtras > 84) continue;
      const semana = Math.floor(s.diasAtras / 7);
      const actual = semanas.get(semana) ?? { carga: 0, rpes: [] };
      actual.carga += s.cargaMetabolica;
      actual.rpes.push(s.rpe);
      semanas.set(semana, actual);
    }
    return [...semanas.entries()]
      .filter(([, v]) => v.rpes.length > 0)
      .map(([semana, v]) => ({
        x: Math.round(v.carga),
        y: Math.round((v.rpes.reduce((a, b) => a + b, 0) / v.rpes.length) * 10) / 10,
        reciente: semana <= 1,
      }));
  }, [sesiones]);

  if (puntos.length < 3) return null;

  return (
    <section>
      <h2 className="u-label">Volumen y esfuerzo</h2>
      <p className="u-sub mt-1">
        Cada punto es una semana. Si podés cargar más sin que suba el esfuerzo medio, estás
        ganando base. Las semanas recientes van en lima.
      </p>
      <div className="mt-4 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis type="number" dataKey="x" name="Carga" {...ejeProps(tema)} />
            <YAxis type="number" dataKey="y" name="RPE medio" domain={[1, 10]} {...ejeProps(tema)} width={44} />
            <Tooltip
              {...tooltipProps(tema)}
              cursor={{ stroke: chart.axis, strokeDasharray: '3 3' }}
              formatter={(v, nombre) => [numero(v), String(nombre)]}
              labelFormatter={() => ''}
            />
            <Scatter data={puntos} dataKey="y" r={5}>
              {puntos.map((p, i) => (
                <Cell key={i} fill={p.reciente ? chart.acento : chart.contexto} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
