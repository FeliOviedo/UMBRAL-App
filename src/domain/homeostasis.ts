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
   * comparable a alguien que corre 20 km/semana con alguien que corre 80.
   */
  balanceNormalizado: number;
  estado: EstadoHomeostasis;
}

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

  for (const { diasAtras, carga } of cargas) {
    if (diasAtras < 0 || diasAtras > ventanaDias || carga <= 0) continue;
    fatiga += carga * factorFatiga * Math.exp(-diasAtras / fatigaTauDias);
    forma += carga * Math.exp(-diasAtras / formaTauDias);
    cargaTotal += carga;
  }

  const balance = forma - fatiga;

  // Normalizar por la carga diaria media evita que el estado dependa del
  // volumen absoluto del corredor.
  const cargaDiariaMedia = Math.max(
    cargaTotal / ventanaDias,
    HOMEOSTASIS_CONFIG.cargaMinimaSignificativa / ventanaDias,
  );
  const balanceNormalizado = balance / (cargaDiariaMedia * fatigaTauDias);

  return { fatiga, forma, balance, balanceNormalizado, estado: clasificar(balanceNormalizado) };
}

function clasificar(balanceNormalizado: number): EstadoHomeostasis {
  const { umbralFatigado, umbralPico, umbralSobreDescansado } = HOMEOSTASIS_CONFIG;
  if (balanceNormalizado < umbralFatigado) return 'fatigado';
  if (balanceNormalizado > umbralSobreDescansado) return 'sobre-descansado';
  if (balanceNormalizado > umbralPico) return 'pico';
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
