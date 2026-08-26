/**
 * Tokens y helpers de los gráficos.
 *
 * Todos los gráficos de la app salen de acá, para que la Caja Negra, el
 * progreso de volumen y el calendario se lean como un solo sistema y no como
 * tres librerías distintas pegadas.
 *
 * La rampa `INTENSIDAD` está VALIDADA: un solo hue (spread 3°), luminosidad
 * monótona, saltos de ΔL ≥ 0.06 y el extremo bajo con contraste 2.01:1 sobre el
 * fondo. Si se toca alguno de esos cuatro valores hay que volver a validarla —
 * no alcanza con que "se vea bien".
 */

/** Colores de los ejes, la grilla y el texto. Recesivos a propósito. */
export const CHART = {
  grid: 'hsl(215 21% 17%)', // --border
  axis: 'hsl(68 8% 56%)', // --outline
  texto: 'hsl(210 15% 65%)', // --fg-muted
  acento: '#CDFF4F',
  acentoDim: '#A7D626',
  /** Para las series de contexto que no son la protagonista. */
  contexto: '#5B6B7A',
  superficie: '#151A22',
  fondo: '#0B0E13',
} as const;

/**
 * Rampa ordinal de intensidad, del descanso al trabajo duro.
 *
 * Un solo hue en cuatro pasos: es la forma correcta para una escala ordenada.
 * La identidad del tipo (F/E/R/D) NO la lleva el color sino la letra dentro de
 * la celda — así el color codifica magnitud y la letra codifica identidad, sin
 * que ninguno de los dos tenga que hacer los dos trabajos.
 */
export const INTENSIDAD = ['#3A4A22', '#6B8A2E', '#9DCB3E', '#CDFF4F'] as const;

/** Intensidad relativa de cada tipo de entrenamiento, de 0 a 3. */
export const NIVEL_INTENSIDAD: Record<string, number> = {
  D: -1, // sin carga: se pinta con la superficie, fuera de la rampa
  R: 0,
  F: 1,
  E: 3,
};

/** Color de la celda del calendario según el tipo de sesión. */
export function colorPorTipo(tipo: string | null): string {
  if (tipo === null) return CHART.superficie;
  const nivel = NIVEL_INTENSIDAD[tipo];
  if (nivel === undefined || nivel < 0) return CHART.superficie;
  return INTENSIDAD[nivel] ?? CHART.superficie;
}

/** Props comunes de los ejes, para no repetirlas en cada gráfico. */
export const EJE_PROPS = {
  stroke: CHART.axis,
  tick: { fill: CHART.texto, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
} as const;

/** Estilo del tooltip, alineado con las superficies del design system. */
export const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: CHART.superficie,
    border: `1px solid ${CHART.grid}`,
    borderRadius: 8,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 12,
  },
  labelStyle: { color: CHART.texto, fontSize: 11 },
  itemStyle: { color: '#F4F6F8' },
} as const;

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
