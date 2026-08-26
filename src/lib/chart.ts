/**
 * Tokens y helpers de los gráficos.
 *
 * Todos los gráficos de la app salen de acá, para que la Caja Negra, el
 * progreso de volumen y el calendario se lean como un solo sistema y no como
 * tres librerías distintas pegadas.
 *
 * Recharts pinta en SVG con colores resueltos en JS, no con las variables CSS
 * del tema — por eso hay dos juegos de tokens (`DARK` y `LIGHT`) en vez de uno
 * solo con `hsl(var(--x))`. `chartTokens(tema)` elige el que corresponde; cada
 * pantalla que dibuja un gráfico lee el tema activo y se lo pasa.
 *
 * La rampa `INTENSIDAD_OSCURA` está VALIDADA: un solo hue (spread 3°),
 * luminosidad monótona, saltos de ΔL ≥ 0.06 y el extremo bajo con contraste
 * 2.01:1 sobre el fondo oscuro. `INTENSIDAD_CLARA` es su equivalente para el
 * tema claro (mismo hue, luminosidad invertida para seguir siendo legible
 * sobre blanco). Si se toca alguno de los dos hay que volver a validarlo con
 * el script del skill de dataviz — no alcanza con que "se vea bien".
 */

export type Tema = 'dark' | 'light';

export interface ChartTokens {
  grid: string;
  axis: string;
  texto: string;
  acento: string;
  acentoDim: string;
  /** Para las series de contexto que no son la protagonista. */
  contexto: string;
  superficie: string;
  fondo: string;
  /** Color de texto sobre `acento`/`superficie` en tooltips y celdas llenas. */
  textoSobreAcento: string;
}

const DARK: ChartTokens = {
  grid: '#232B36', // --border
  axis: '#8E937C', // --outline
  texto: '#9AA7B4', // --fg-muted
  acento: '#CDFF4F',
  acentoDim: '#A7D626',
  contexto: '#5B6B7A',
  superficie: '#151A22',
  fondo: '#0B0E13',
  textoSobreAcento: '#0B0E13',
};

const LIGHT: ChartTokens = {
  grid: '#e2e2e2', // --border
  axis: '#6b6263', // --outline
  texto: '#474747', // --fg-muted
  // El acento claro es el lima apagado: el brillante da 1.4:1 sobre blanco.
  acento: '#A7D626',
  acentoDim: '#8FB621',
  // Un gris azulado más oscuro que el de dark: el original queda lavado sobre blanco.
  contexto: '#7A8A99',
  superficie: '#eeeeee',
  fondo: '#ffffff',
  textoSobreAcento: '#1b1b1b',
};

export function chartTokens(tema: Tema): ChartTokens {
  return tema === 'light' ? LIGHT : DARK;
}

/**
 * Rampa ordinal de intensidad, del descanso al trabajo duro.
 *
 * Un solo hue en cuatro pasos: es la forma correcta para una escala ordenada.
 * La identidad del tipo (F/E/R/D) NO la lleva el color sino la letra dentro de
 * la celda — así el color codifica magnitud y la letra codifica identidad, sin
 * que ninguno de los dos tenga que hacer los dos trabajos.
 */
export const INTENSIDAD_OSCURA = ['#3A4A22', '#6B8A2E', '#9DCB3E', '#CDFF4F'] as const;

/**
 * Mismo hue que `INTENSIDAD_OSCURA`, pero pensado para fondo blanco: la
 * oscura de más "descansa" ya es visible sobre blanco (a diferencia de la
 * más clara del oscuro, que se hundiría), y el extremo de más carga es el
 * acento apagado del tema claro en vez del lima brillante.
 */
export const INTENSIDAD_CLARA = ['#C4D9A0', '#9FC466', '#7BA83A', '#5C8A1F'] as const;

export function intensidad(tema: Tema): readonly string[] {
  return tema === 'light' ? INTENSIDAD_CLARA : INTENSIDAD_OSCURA;
}

/** Intensidad relativa de cada tipo de entrenamiento, de 0 a 3. */
export const NIVEL_INTENSIDAD: Record<string, number> = {
  D: -1, // sin carga: se pinta con la superficie, fuera de la rampa
  R: 0,
  F: 1,
  E: 3,
};

/** Color de la celda del calendario según el tipo de sesión. */
export function colorPorTipo(tipo: string | null, tema: Tema): string {
  const tokens = chartTokens(tema);
  if (tipo === null) return tokens.superficie;
  const nivel = NIVEL_INTENSIDAD[tipo];
  if (nivel === undefined || nivel < 0) return tokens.superficie;
  return intensidad(tema)[nivel] ?? tokens.superficie;
}

/** Props comunes de los ejes, para no repetirlas en cada gráfico. */
export function ejeProps(tema: Tema) {
  const tokens = chartTokens(tema);
  return {
    stroke: tokens.axis,
    tick: { fill: tokens.texto, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
    tickLine: false,
    axisLine: { stroke: tokens.grid },
  } as const;
}

/** Estilo del tooltip, alineado con las superficies del design system. */
export function tooltipProps(tema: Tema) {
  const tokens = chartTokens(tema);
  return {
    contentStyle: {
      backgroundColor: tokens.superficie,
      border: `1px solid ${tokens.grid}`,
      borderRadius: 8,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
    },
    labelStyle: { color: tokens.texto, fontSize: 11 },
    itemStyle: { color: tema === 'light' ? '#1b1b1b' : '#F4F6F8' },
  } as const;
}

/**
 * Recta de regresión por mínimos cuadrados.
 *
 * Se usa en las dispersiones de la Caja Negra para mostrar la tendencia. No es
 * una predicción: con veinte puntos y RPE estimado a ojo, la pendiente sirve
 * para ver la dirección, no para extrapolar.
 */
export function regresionLineal(
  puntos: readonly { x: number; y: number }[],
): { m: number; b: number; r2: number } | null {
  const n = puntos.length;
  if (n < 3) return null;

  const sumX = puntos.reduce((s, p) => s + p.x, 0);
  const sumY = puntos.reduce((s, p) => s + p.y, 0);
  const sumXY = puntos.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = puntos.reduce((s, p) => s + p.x * p.x, 0);

  const denominador = n * sumX2 - sumX * sumX;
  if (Math.abs(denominador) < 1e-9) return null; // todos los x iguales

  const m = (n * sumXY - sumX * sumY) / denominador;
  const b = (sumY - m * sumX) / n;

  const mediaY = sumY / n;
  const ssTot = puntos.reduce((s, p) => s + (p.y - mediaY) ** 2, 0);
  const ssRes = puntos.reduce((s, p) => s + (p.y - (m * p.x + b)) ** 2, 0);
  const r2 = ssTot < 1e-9 ? 0 : 1 - ssRes / ssTot;

  return { m, b, r2 };
}

/**
 * Normaliza lo que Recharts le pasa a un formatter.
 *
 * Sus tipos declaran `ValueType`, que puede ser número, texto, arreglo o
 * `undefined`. Todos los datos de la app son numéricos, así que se convierte
 * una vez acá en lugar de castear en cada gráfico.
 */
export function numero(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}
