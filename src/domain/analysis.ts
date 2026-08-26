/**
 * Análisis del historial: ¿estás progresando?
 *
 * La "caja negra" del título es la de la metodología: entra entrenamiento, sale
 * adaptación, y lo único que se puede observar desde afuera es la relación
 * entre esfuerzo y resultado. Si para el MISMO pace en Z2 el RPE baja con las
 * semanas, la caja está haciendo su trabajo.
 *
 * El RPE es el indicador PRINCIPAL. La FC entra sólo como confirmación, y
 * únicamente si el reloj dio números coherentes: dos sesiones con la misma FC
 * media pero cinco semanas de diferencia dicen poco si el sensor midió mal una
 * de las dos.
 */

import { ADAPTATION_CONFIG, HOMEOSTASIS_CONFIG } from './config';
import { calcularHomeostasis, type CargaPuntual, type Homeostasis } from './homeostasis';

/** Una sesión, reducida a lo que el análisis necesita. */
export interface SesionAnalizable {
  /** Días transcurridos desde la sesión hasta hoy. */
  diasAtras: number;
  /** Pace medio en segundos por km. `null` si no se midió. */
  paceSecPerKm: number | null;
  rpe: number;
  /** FC media. `null` si no se midió o no es confiable. */
  fcPromedio: number | null;
  cargaMetabolica: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Caja negra: ¿baja el esfuerzo para el mismo pace?
// ─────────────────────────────────────────────────────────────────────────────

export type VeredictoCajaNegra = 'progreso' | 'estable' | 'retroceso' | 'sin-datos';

export interface CajaNegra {
  veredicto: VeredictoCajaNegra;
  /** Cuántas sesiones comparables se pudieron usar. */
  sesionesComparadas: number;
  /** RPE medio del grupo más antiguo. `null` si no hay datos. */
  rpeAntes: number | null;
  /** RPE medio del grupo más reciente. */
  rpeDespues: number | null;
  /** Diferencia de RPE (después − antes). Negativo = mejora. */
  deltaRpe: number | null;
  /** Lo mismo para la FC, sólo si hay dato en los dos grupos. */
  fcAntes: number | null;
  fcDespues: number | null;
  deltaFc: number | null;
  /** Explicación en lenguaje de entrenador. */
  mensaje: string;
}

/**
 * Tolerancia de pace para considerar dos sesiones "al mismo ritmo".
 *
 * ±15 s/km es lo que se mueve el pace por el viento, un semáforo o una cuesta
 * suave. Más estricto que eso dejaría fuera casi todas las sesiones reales.
 */
const TOLERANCIA_PACE_SEG = 15;

/** Mínimo de sesiones por grupo para que la comparación signifique algo. */
const MINIMO_POR_GRUPO = 2;

/**
 * RPE a partir del cual una sesión se considera un esfuerzo máximo y queda
 * fuera de la comparación.
 *
 * En un test al límite el RPE lo fija la intención ("dar todo"), no la
 * condición física, así que no dice nada sobre si el cuerpo mejoró.
 */
const RPE_ESFUERZO_MAXIMO = 9;

/**
 * Compara el esfuerzo percibido de las sesiones antiguas contra las recientes,
 * al mismo pace.
 *
 * El filtro es por PACE, no por RPE. Filtrar por RPE sería sesgar la muestra
 * justo en la variable que se está midiendo: si sólo se miraran las sesiones
 * que ya son fáciles, un corredor que pasó de sufrir un ritmo a hacerlo cómodo
 * quedaría invisible, que es exactamente el progreso que la metodología busca
 * detectar. Sólo se descartan los esfuerzos máximos, por la razón de arriba.
 *
 * @param paceReferencia Pace sobre el que comparar, en segundos por km.
 *   Normalmente el pace habitual de rodaje del corredor.
 */
export function cajaNegra(
  sesiones: readonly SesionAnalizable[],
  paceReferencia: number,
): CajaNegra {
  const comparables = sesiones
    .filter(
      (s) =>
        s.paceSecPerKm !== null &&
        Math.abs(s.paceSecPerKm - paceReferencia) <= TOLERANCIA_PACE_SEG &&
        s.rpe < RPE_ESFUERZO_MAXIMO,
    )
    .sort((a, b) => b.diasAtras - a.diasAtras); // del más viejo al más nuevo

  const vacio: CajaNegra = {
    veredicto: 'sin-datos',
    sesionesComparadas: comparables.length,
    rpeAntes: null,
    rpeDespues: null,
    deltaRpe: null,
    fcAntes: null,
    fcDespues: null,
    deltaFc: null,
    mensaje:
      'Todavía no hay suficientes sesiones en zona aeróbica al mismo ritmo para comparar. ' +
      'Después de unas cuantas salidas fáciles vas a poder ver si el esfuerzo baja.',
  };

  if (comparables.length < MINIMO_POR_GRUPO * 2) return vacio;

  // Mitad más antigua contra mitad más reciente.
  const corte = Math.floor(comparables.length / 2);
  const antes = comparables.slice(0, corte);
  const despues = comparables.slice(corte);

  const rpeAntes = promedio(antes.map((s) => s.rpe));
  const rpeDespues = promedio(despues.map((s) => s.rpe));
  const deltaRpe = rpeDespues - rpeAntes;

  const fcAntes = promedioDefinido(antes.map((s) => s.fcPromedio));
  const fcDespues = promedioDefinido(despues.map((s) => s.fcPromedio));
  const deltaFc = fcAntes !== null && fcDespues !== null ? fcDespues - fcAntes : null;

  const veredicto = dictaminar(deltaRpe);

  return {
    veredicto,
    sesionesComparadas: comparables.length,
    rpeAntes: redondear(rpeAntes),
    rpeDespues: redondear(rpeDespues),
    deltaRpe: redondear(deltaRpe),
    fcAntes: fcAntes === null ? null : Math.round(fcAntes),
    fcDespues: fcDespues === null ? null : Math.round(fcDespues),
    deltaFc: deltaFc === null ? null : Math.round(deltaFc),
    mensaje: explicarCajaNegra(veredicto, deltaRpe, deltaFc, paceReferencia),
  };
}

function dictaminar(deltaRpe: number): VeredictoCajaNegra {
  const umbral = ADAPTATION_CONFIG.rpeImprovementThreshold;
  if (deltaRpe <= -umbral) return 'progreso';
  if (deltaRpe >= umbral) return 'retroceso';
  return 'estable';
}

function explicarCajaNegra(
  veredicto: VeredictoCajaNegra,
  deltaRpe: number,
  deltaFc: number | null,
  paceReferencia: number,
): string {
  const pace = `${Math.floor(paceReferencia / 60)}:${String(Math.round(paceReferencia % 60)).padStart(2, '0')}/km`;

  // La FC sólo se menciona cuando acompaña. Si contradice al RPE, se ignora en
  // silencio: es el dato menos confiable de los dos.
  const apoyoFc =
    deltaFc !== null && Math.abs(deltaFc) >= ADAPTATION_CONFIG.hrImprovementThresholdBpm
      ? ` Tu frecuencia cardíaca al mismo ritmo ${deltaFc < 0 ? 'bajó' : 'subió'} ${Math.abs(deltaFc)} ppm, que apunta en la misma dirección.`
      : '';

  switch (veredicto) {
    case 'progreso':
      return (
        `Correr a ${pace} te está costando menos que hace unas semanas: el esfuerzo percibido ` +
        `bajó ${Math.abs(redondear(deltaRpe))} puntos.${apoyoFc} Eso es exactamente lo que ` +
        'busca el ciclo de base.'
      );
    case 'retroceso':
      return (
        `Correr a ${pace} te está costando más que antes: el esfuerzo percibido subió ` +
        `${redondear(deltaRpe)} puntos.${apoyoFc} Puede ser fatiga acumulada, una mala racha ` +
        'de sueño o algo fuera del entrenamiento. Si sigue así un par de semanas, conviene bajar la carga.'
      );
    case 'estable':
      return (
        `El esfuerzo a ${pace} se mantiene parejo.${apoyoFc} En una fase de carga es una buena ` +
        'señal: estás sosteniendo el ritmo con más volumen encima.'
      );
    case 'sin-datos':
      return 'Faltan datos para comparar.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de supercompensación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado actual de carga y recuperación, incluyendo las actividades
 * complementarias.
 *
 * No hay un parámetro aparte para "complementarias": entran en `sesiones` como
 * cualquier otra, porque la carga metabólica es unificada. Que el modelo no
 * distinga es la característica, no una simplificación.
 */
export function estadoSupercompensacion(sesiones: readonly SesionAnalizable[]): Homeostasis {
  const cargas: CargaPuntual[] = sesiones.map((s) => ({
    diasAtras: s.diasAtras,
    carga: s.cargaMetabolica,
  }));
  return calcularHomeostasis(cargas);
}

/** Carga metabólica total de los últimos N días. Para el gráfico de volumen. */
export function cargaEnVentana(sesiones: readonly SesionAnalizable[], dias: number): number {
  return sesiones
    .filter((s) => s.diasAtras >= 0 && s.diasAtras < dias)
    .reduce((sum, s) => sum + s.cargaMetabolica, 0);
}

/**
 * Serie diaria de balance para dibujar la curva de supercompensación.
 *
 * Devuelve un punto por día, del más antiguo al de hoy.
 */
export function serieDeBalance(
  sesiones: readonly SesionAnalizable[],
  dias: number = HOMEOSTASIS_CONFIG.ventanaDias,
): { diasAtras: number; balanceNormalizado: number }[] {
  const puntos: { diasAtras: number; balanceNormalizado: number }[] = [];

  for (let d = dias - 1; d >= 0; d--) {
    // Para el día `d` sólo cuentan las sesiones anteriores a ese día.
    const cargas: CargaPuntual[] = sesiones
      .filter((s) => s.diasAtras >= d)
      .map((s) => ({ diasAtras: s.diasAtras - d, carga: s.cargaMetabolica }));
    puntos.push({ diasAtras: d, balanceNormalizado: calcularHomeostasis(cargas).balanceNormalizado });
  }

  return puntos;
}

// ─────────────────────────────────────────────────────────────────────────────

function promedio(valores: readonly number[]): number {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function promedioDefinido(valores: readonly (number | null)[]): number | null {
  const definidos = valores.filter((v): v is number => v !== null);
  return definidos.length === 0 ? null : promedio(definidos);
}

function redondear(n: number): number {
  return Math.round(n * 10) / 10;
}
