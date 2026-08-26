/**
 * Modelo de homeostasis: cómo se acumula la carga y cómo se recupera el cuerpo.
 *
 * Es el sustrato del motor de adaptación. Todo lo que entra acá es carga
 * metabólica —el número unificado que produce `sessionAnalysis`—, sin importar
 * de qué disciplina venga: una corrida, una sesión de gimnasio y un partido de
 * fútbol suman al mismo modelo. Ese es justamente el punto.
 *
 * Dos exponenciales, al estilo Banister: cada sesión suma un impulso a la
 * fatiga y otro a la forma. La fatiga pega más fuerte pero se va rápido; la
 * forma sube poco pero queda. Lo que se lee como "estado" es la diferencia.
 */

import { HOMEOSTASIS_CONFIG } from './config';

/** Una carga puntual en el tiempo. Todo lo que el modelo necesita saber. */
export interface CargaPuntual {
  /** Días transcurridos desde esta sesión hasta el momento que se evalúa. */
  diasAtras: number;
  /** Carga metabólica de la sesión. */
  carga: number;
}

export type EstadoHomeostasis = 'fatigado' | 'listo' | 'pico' | 'sobre-descansado';

export interface Homeostasis {
  /** Fatiga acumulada. Sube rápido y baja rápido. */
  fatiga: number;
  /** Forma acumulada. Sube despacio y baja despacio. */
  forma: number;
  /** forma − fatiga. El número que se interpreta. */
  balance: number;
  /**
   * Balance normalizado por la carga diaria media del período. Es lo que hace
   * comparable a alguien que corre 20 km/semana con alguien que corre 80, y es
   * la serie que se dibuja como curva de supercompensación.
   */
  balanceNormalizado: number;
  /**
   * Ratio fatiga/forma medido en múltiplos del equilibrio.
   *
   * 1.0 es exactamente el estado estacionario de alguien que entrena de forma
   * sostenida; por encima hay más fatiga de la habitual y por debajo, menos.
   * Es el número que se clasifica.
   */
  ratioRelativo: number;
  estado: EstadoHomeostasis;
}

/**
 * Ratio fatiga/forma al que converge el modelo con carga constante.
 *
 * Sale de integrar las dos exponenciales sobre la ventana que el modelo mira
 * de verdad: cada una acumula τ × (1 − e^(−ventana/τ)). El truncado NO es un
 * detalle despreciable — con ventana de 42 días la fatiga (τ=7) ya llegó a su
 * asíntota pero la forma (τ=42) apenas alcanzó el 63% de la suya, así que
 * usar el equilibrio de horizonte infinito daría 1.57 para alguien que entrena
 * perfectamente parejo. La referencia tiene que ser el estacionario de lo que
 * el código calcula, no el de la fórmula ideal.
 */
export const RATIO_EQUILIBRIO = (() => {
  const { factorFatiga, fatigaTauDias, formaTauDias, ventanaDias } = HOMEOSTASIS_CONFIG;
  const acumulado = (tau: number) => tau * (1 - Math.exp(-ventanaDias / tau));
  return (factorFatiga * acumulado(fatigaTauDias)) / acumulado(formaTauDias);
})();

/**
 * Calcula el estado a partir de las cargas de las últimas semanas.
 *
 * Las cargas de más de `ventanaDias` se ignoran: su aporte al modelo es menor
 * que el ruido de haber estimado el RPE a ojo.
 */
export function calcularHomeostasis(cargas: readonly CargaPuntual[]): Homeostasis {
  const { fatigaTauDias, formaTauDias, factorFatiga, ventanaDias } = HOMEOSTASIS_CONFIG;

  let fatiga = 0;
  let forma = 0;
  let cargaTotal = 0;
  let cargaReciente = 0;

  for (const { diasAtras, carga } of cargas) {
    if (diasAtras < 0 || diasAtras > ventanaDias || carga <= 0) continue;
    fatiga += carga * factorFatiga * Math.exp(-diasAtras / fatigaTauDias);
    forma += carga * Math.exp(-diasAtras / formaTauDias);
    cargaTotal += carga;
    if (diasAtras < HOMEOSTASIS_CONFIG.ventanaDesentrenamientoDias) cargaReciente += carga;
  }

  const balance = forma - fatiga;

  // Normalizar por la carga diaria media evita que el estado dependa del
  // volumen absoluto del corredor.
  const cargaDiariaMedia = Math.max(
    cargaTotal / ventanaDias,
    HOMEOSTASIS_CONFIG.cargaMinimaSignificativa / ventanaDias,
  );
  const balanceNormalizado = balance / (cargaDiariaMedia * fatigaTauDias);
  const ratioRelativo = forma > 0 ? fatiga / forma / RATIO_EQUILIBRIO : 0;

  return {
    fatiga,
    forma,
    balance,
    balanceNormalizado,
    ratioRelativo,
    estado: clasificar(ratioRelativo, cargaTotal, cargaReciente),
  };
}

/**
 * Clasifica el estado comparando contra el equilibrio, no contra constantes.
 *
 * El desentrenamiento se chequea aparte y primero, porque no es un punto de la
 * misma escala: alguien que dejó de entrenar tiene poca fatiga —igual que
 * alguien en supercompensación— pero está perdiendo forma, no listo para
 * rendir. Lo que los distingue no es el ratio sino si sigue habiendo carga.
 */
function clasificar(
  ratioRelativo: number,
  cargaTotal: number,
  cargaReciente: number,
): EstadoHomeostasis {
  const {
    umbralFatigado,
    umbralPico,
    umbralSobreDescansado,
    ventanaDias,
    ventanaDesentrenamientoDias,
    cargaMinimaSignificativa,
  } = HOMEOSTASIS_CONFIG;

  if (cargaTotal < cargaMinimaSignificativa) return 'sobre-descansado';

  // Ritmo reciente contra el ritmo de toda la ventana: si cayó por debajo de la
  // fracción configurada, la persona dejó de entrenar.
  const ritmoReciente = cargaReciente / ventanaDesentrenamientoDias;
  const ritmoHabitual = cargaTotal / ventanaDias;
  if (ritmoReciente < umbralSobreDescansado * ritmoHabitual) return 'sobre-descansado';

  if (ratioRelativo > umbralFatigado) return 'fatigado';
  if (ratioRelativo < umbralPico) return 'pico';
  return 'listo';
}

/**
 * Explica el estado en lenguaje de entrenador.
 *
 * El motor nunca decide en silencio: cada lectura tiene que poder contarse.
 */
export function explicarEstado(estado: EstadoHomeostasis): {
  titulo: string;
  detalle: string;
} {
  switch (estado) {
    case 'fatigado':
      return {
        titulo: 'Fatigado',
        detalle:
          'Venís acumulando más carga de la que estás recuperando. No es una señal de alarma ' +
          'si estás en semana de carga, pero sí conviene respetar los días fáciles como fáciles.',
      };
    case 'listo':
      return {
        titulo: 'Listo',
        detalle:
          'Carga y recuperación están en equilibrio. Es el estado normal en el que transcurre ' +
          'la mayor parte de un plan: podés entrenar lo que está planificado.',
      };
    case 'pico':
      return {
        titulo: 'En supercompensación',
        detalle:
          'La fatiga bajó y la forma quedó. Es el mejor momento para una sesión exigente o ' +
          'para una carrera: estás rindiendo por encima de tu línea de base.',
      };
    case 'sobre-descansado':
      return {
        titulo: 'Sobre-descansado',
        detalle:
          'Hace bastante que no acumulás carga y la forma empezó a caer. Si venías de una ' +
          'pausa, retomá progresivamente en lugar de saltar directo al volumen de antes.',
      };
  }
}

/**
 * Cuántos días de recuperación pide una carga externa antes de una sesión dura.
 *
 * Es la regla que usa el motor cuando alguien mete un partido de fútbol el día
 * antes de un Específico. La escala es deliberadamente gruesa —0, 1 o 2 días—
 * porque pretender más precisión con un RPE estimado a ojo sería falsa exactitud.
 */
export function diasDeRecuperacionQuePide(cargaMetabolica: number): number {
  if (cargaMetabolica >= 400) return 2;
  if (cargaMetabolica >= 200) return 1;
  return 0;
}
