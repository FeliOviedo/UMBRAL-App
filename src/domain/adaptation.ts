/**
 * Motor de adaptación: qué hacer cuando la realidad no coincide con el plan.
 *
 * Determinista de punta a punta: mismas entradas, mismas decisiones. Nada de
 * azar, nada de heurísticas escondidas. Cada decisión sale de una regla que se
 * puede leer acá y de un umbral que vive en `config.ts`.
 *
 * Dos invariantes que el motor NO puede romper:
 *
 * 1. Toda semana que devuelve pasa por `validarMicrociclo`. Si una adaptación
 *    dejara la semana violando R1-R4, se descarta y se explica por qué.
 * 2. Toda decisión viene con su explicación en español, escrita como la diría
 *    un entrenador. El motor nunca cambia el plan en silencio.
 *
 * La redacción son plantillas de texto. `redactarConCoach` es el punto de
 * enganche para que más adelante una capa LLM las reescriba con más naturalidad
 * sin tocar la lógica.
 */

import { ADAPTATION_CONFIG, TRAINING_TYPE_TARGETS } from './config';
import { diasDeRecuperacionQuePide } from './homeostasis';
import { repararMicrociclo, validarMicrociclo } from './rules';
import type { PlannedDay, TrainingType } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Qué disparó la adaptación. Uno por cada caso de la metodología. */
export type MotivoAdaptacion =
  | 'sesion-omitida'
  | 'carga-externa'
  | 'feedback-pobre'
  | 'buena-adaptacion'
  | 'retest-mesociclo'
  | 'progresion-volumen'
  | 'feasibilidad-objetivo';

/** Qué hizo el motor con la semana. */
export type AccionAdaptacion =
  | 'reordenar'
  | 'degradar-sesion'
  | 'insertar-recuperacion'
  | 'ninguna';

export interface Adaptacion {
  motivo: MotivoAdaptacion;
  accion: AccionAdaptacion;
  /** Título corto, para encabezar la tarjeta. */
  titulo: string;
  /** Explicación completa, en lenguaje de entrenador. */
  explicacion: string;
  /** La semana como quedaría. `null` si la acción no toca el plan. */
  semanaPropuesta: PlannedDay[] | null;
  /** Días cuyo tipo cambió respecto del original. Para resaltar el diff. */
  diasModificados: number[];
  /**
   * true si la propuesta es segura de aplicar. Cuando es false, el motor
   * encontró el problema pero no una solución que respete R1-R4, y lo que
   * corresponde es avisar en lugar de tocar el plan.
   */
  aplicable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Caso 1 — Sesión omitida
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El usuario se saltó una sesión: se reordena lo que queda de la semana.
 *
 * Los R son comodines (R3), así que reordenar casi siempre encuentra una
 * secuencia legal. Lo que NO se hace es mover la sesión omitida a otro día
 * apretando la semana: si se perdió un día, se perdió — comprimir dos sesiones
 * duras es exactamente lo que R1 y R2 existen para impedir.
 */
export function adaptarPorSesionOmitida(
  semana: readonly PlannedDay[],
  diaOmitido: number,
): Adaptacion {
  const omitido = semana.find((d) => d.dayIndex === diaOmitido);
  const restantes = semana.filter((d) => d.dayIndex !== diaOmitido);
  const propuesta = repararMicrociclo(restantes);
  const validacion = validarMicrociclo(propuesta);

  const etiqueta = omitido ? TRAINING_TYPE_TARGETS[omitido.type ?? 'D'].label : 'la sesión';

  if (!validacion.valid) {
    return {
      motivo: 'sesion-omitida',
      accion: 'ninguna',
      titulo: 'No se puede reordenar la semana',
      explicacion:
        `Te salteaste ${etiqueta.toLowerCase()}, pero con lo que queda de la semana no hay ` +
        'forma de reordenar sin juntar dos sesiones duras. Lo más sano es dejar la semana como ' +
        'está y retomar el plan la que viene.',
      semanaPropuesta: null,
      diasModificados: [],
      aplicable: false,
    };
  }

  const diasModificados = diferencias(restantes, propuesta);

  return {
    motivo: 'sesion-omitida',
    accion: diasModificados.length > 0 ? 'reordenar' : 'ninguna',
    titulo: diasModificados.length > 0 ? 'Semana reordenada' : 'No hace falta reordenar',
    explicacion:
      diasModificados.length > 0
        ? `Te salteaste ${etiqueta.toLowerCase()}. Reordené los días que quedan para que no ` +
          'queden dos sesiones duras seguidas ni un Específico justo después del largo. El ' +
          'volumen de la semana baja, pero eso es preferible a apretar el calendario.'
        : `Te salteaste ${etiqueta.toLowerCase()}. El resto de la semana ya está en un orden ` +
          'que funciona, así que no toqué nada.',
    semanaPropuesta: propuesta,
    diasModificados,
    aplicable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Caso 2 — Carga externa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El usuario metió una actividad no planificada (fútbol, gimnasio) y al día
 * siguiente tenía una sesión exigente.
 *
 * La carga externa suma al modelo de homeostasis igual que cualquier otra
 * sesión; lo que decide acá es si esa carga pide postergar la sesión dura. La
 * degradación va de E/F a R, nunca a D: sacar el día entero rompería el volumen
 * de la semana más de lo necesario.
 */
export function adaptarPorCargaExterna(
  semana: readonly PlannedDay[],
  params: {
    /** Día en que ocurrió la actividad externa. */
    diaActividad: number;
    /** Carga metabólica que aportó. */
    cargaMetabolica: number;
    /** Cómo se llama, para poder nombrarla. */
    nombreActividad: string;
  },
): Adaptacion {
  const { diaActividad, cargaMetabolica, nombreActividad } = params;
  const diasPedidos = diasDeRecuperacionQuePide(cargaMetabolica);

  const sinCambios = (explicacion: string): Adaptacion => ({
    motivo: 'carga-externa',
    accion: 'ninguna',
    titulo: 'El plan sigue igual',
    explicacion,
    semanaPropuesta: null,
    diasModificados: [],
    aplicable: true,
  });

  if (diasPedidos === 0) {
    return sinCambios(
      `Registré ${nombreActividad}. Fue una carga liviana, así que no cambia nada del plan: ` +
        'suma al modelo de recuperación y listo.',
    );
  }

  // Los días exigentes dentro de la ventana de recuperación.
  const afectados = semana.filter(
    (d) =>
      d.dayIndex > diaActividad &&
      d.dayIndex <= diaActividad + diasPedidos &&
      (d.type === 'E' || d.type === 'F'),
  );

  if (afectados.length === 0) {
    return sinCambios(
      `Registré ${nombreActividad}. Pide ${diasPedidos === 1 ? 'un día' : 'dos días'} de ` +
        'recuperación, y justo no tenías nada exigente ahí: el plan sigue igual.',
    );
  }

  // Se degrada el primero: si hay dos, encadenar dos degradaciones por una sola
  // actividad externa sería pasarse de conservador.
  const aDegradar = afectados[0]!;
  const propuesta: PlannedDay[] = semana.map((d) =>
    d.dayIndex === aDegradar.dayIndex
      ? { ...d, type: 'R' as TrainingType, km: Math.round(d.km * 0.5 * 2) / 2, targetZone: 'Z1', targetRpe: 2 }
      : { ...d },
  );

  const validacion = validarMicrociclo(propuesta);
  const etiquetaOriginal = TRAINING_TYPE_TARGETS[aDegradar.type].label;

  if (!validacion.valid) {
    return sinCambios(
      `Registré ${nombreActividad}. Idealmente convendría aflojar ${etiquetaOriginal.toLowerCase()} ` +
        'del día siguiente, pero hacerlo dejaría la semana con dos sesiones duras juntas más ' +
        'adelante. Tomalo con cuidado y bajá la intensidad si lo sentís pesado.',
    );
  }

  return {
    motivo: 'carga-externa',
    accion: 'degradar-sesion',
    titulo: `${etiquetaOriginal} pasa a Recuperación`,
    explicacion:
      `${nombreActividad} dejó una carga que pide ${diasPedidos === 1 ? 'un día' : 'dos días'} ` +
      `de recuperación. Bajé ${etiquetaOriginal.toLowerCase()} del día siguiente a Recuperación ` +
      'en Z1, con la mitad de los kilómetros. La carga total de la semana no cambia tanto como ' +
      'parece: parte de ella ya la hiciste en la otra actividad.',
    semanaPropuesta: propuesta,
    diasModificados: [aDegradar.dayIndex],
    aplicable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Caso 3 — Feedback pobre
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La sesión se sintió mucho más dura de lo planificado: se mete recuperación
 * antes del próximo Específico.
 *
 * La señal principal es el RPE. La sensación y la FC entran como confirmación,
 * pero ninguna de las dos dispara sola: la sensación es demasiado ruidosa
 * (dormiste mal, discutiste con alguien) y la FC del reloj no es confiable.
 */
export function adaptarPorFeedbackPobre(
  semana: readonly PlannedDay[],
  params: {
    diaSesion: number;
    rpeReal: number;
    rpePlanificado: number;
    /** Sensación 1-5. Confirma, no dispara. */
    sensacion?: number | null;
  },
): Adaptacion {
  const { diaSesion, rpeReal, rpePlanificado, sensacion } = params;
  const exceso = rpeReal - rpePlanificado;

  const sinCambios = (titulo: string, explicacion: string): Adaptacion => ({
    motivo: 'feedback-pobre',
    accion: 'ninguna',
    titulo,
    explicacion,
    semanaPropuesta: null,
    diasModificados: [],
    aplicable: true,
  });

  if (exceso < ADAPTATION_CONFIG.rpeOvershootThreshold) {
    return sinCambios(
      'Todo en orden',
      'El esfuerzo estuvo dentro de lo esperado para esa sesión. Seguimos con el plan.',
    );
  }

  // El próximo Específico después de esta sesión.
  const proximoE = semana.find((d) => d.dayIndex > diaSesion && d.type === 'E');

  const sensacionMala =
    sensacion != null && sensacion <= ADAPTATION_CONFIG.poorFeelingThreshold;
  const refuerzo = sensacionMala
    ? ' Además marcaste que te sentiste mal, lo que apunta en la misma dirección.'
    : '';

  if (!proximoE) {
    return sinCambios(
      'Anotado: costó más de lo esperado',
      `Esa sesión se sintió ${exceso} puntos de RPE más dura de lo planificado.${refuerzo} ` +
        'No queda ningún Específico esta semana, así que no hay nada que mover — pero tenelo ' +
        'presente si la próxima también cuesta.',
    );
  }

  // El día anterior al Específico es el candidato a volverse recuperación.
  const diaPrevio = semana.find((d) => d.dayIndex === proximoE.dayIndex - 1);

  if (!diaPrevio || diaPrevio.type === 'D' || diaPrevio.type === 'R') {
    return sinCambios(
      'Anotado: costó más de lo esperado',
      `Esa sesión se sintió ${exceso} puntos de RPE más dura de lo planificado.${refuerzo} ` +
        'Por suerte antes del próximo Específico ya tenías un día suave, así que el plan ya ' +
        'te está dando la recuperación que hace falta.',
    );
  }

  const propuesta: PlannedDay[] = semana.map((d) =>
    d.dayIndex === diaPrevio.dayIndex
      ? { ...d, type: 'R' as TrainingType, km: Math.round(d.km * 0.5 * 2) / 2, targetZone: 'Z1', targetRpe: 2 }
      : { ...d },
  );

  if (!validarMicrociclo(propuesta).valid) {
    return sinCambios(
      'Conviene aflojar, pero el calendario no da',
      `Esa sesión se sintió ${exceso} puntos de RPE más dura de lo planificado.${refuerzo} ` +
        'Meter un día suave antes del próximo Específico dejaría la semana mal ordenada. ' +
        'Arrancá ese Específico con cuidado y cortalo si no va.',
    );
  }

  return {
    motivo: 'feedback-pobre',
    accion: 'insertar-recuperacion',
    titulo: 'Un día suave antes del próximo Específico',
    explicacion:
      `Esa sesión se sintió ${exceso} puntos de RPE más dura de lo planificado.${refuerzo} ` +
      `Cambié ${TRAINING_TYPE_TARGETS[diaPrevio.type].label.toLowerCase()} del día previo al ` +
      'próximo Específico por Recuperación en Z1. Llegar entero al trabajo de calidad importa ' +
      'más que sumar los kilómetros de un día.',
    semanaPropuesta: propuesta,
    diasModificados: [diaPrevio.dayIndex],
    aplicable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Caso 4 — Buena adaptación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El RPE bajó para el mismo pace en Z2: se confirma el progreso.
 *
 * Este caso NO toca el plan. Confirmar que algo está funcionando es una
 * decisión del motor tanto como cambiar un día, y merece decirse — pero
 * acelerar la progresión porque una comparación dio bien sería exactamente el
 * error que la metodología busca evitar.
 */
export function adaptarPorBuenaAdaptacion(params: {
  deltaRpe: number;
  deltaFc: number | null;
  enCicloDeBase: boolean;
}): Adaptacion {
  const { deltaRpe, deltaFc, enCicloDeBase } = params;
  const mejora = Math.abs(Math.round(deltaRpe * 10) / 10);

  const apoyoFc =
    deltaFc !== null && deltaFc <= -ADAPTATION_CONFIG.hrImprovementThresholdBpm
      ? ` Tu frecuencia cardíaca al mismo ritmo bajó ${Math.abs(deltaFc)} ppm, que confirma la lectura.`
      : '';

  return {
    motivo: 'buena-adaptacion',
    accion: 'ninguna',
    titulo: 'Estás progresando',
    explicacion:
      `Correr al mismo ritmo te cuesta ${mejora} puntos de RPE menos que hace unas semanas.` +
      apoyoFc +
      (enCicloDeBase
        ? ' Es justo lo que busca el ciclo de base: la misma velocidad con menos esfuerzo. ' +
          'No hay nada que cambiar — el plan está funcionando, seguí como venís.'
        : ' El plan sigue igual: la progresión de volumen ya está calculada y adelantarla ' +
          'porque una semana salió bien es la forma más común de lesionarse.'),
    semanaPropuesta: null,
    diasModificados: [],
    aplicable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Caso 5 — Re-test al cerrar el mesociclo
// ─────────────────────────────────────────────────────────────────────────────

/** Al terminar un mesociclo toca volver a medir el umbral. */
export function adaptarPorCierreDeMesociclo(params: {
  mesociclo: number;
  diasDesdeUltimoTest: number;
}): Adaptacion {
  const { mesociclo, diasDesdeUltimoTest } = params;
  const semanas = Math.floor(diasDesdeUltimoTest / 7);

  return {
    motivo: 'retest-mesociclo',
    accion: 'ninguna',
    titulo: 'Toca volver a testear tu umbral',
    explicacion:
      `Cerraste el mesociclo ${mesociclo} y pasaron ${semanas} semanas desde tu último test. ` +
      'Si progresaste, tus zonas quedaron desactualizadas y vas a estar entrenando más suave ' +
      'de lo que corresponde. Repetí el test de 20 minutos: la semana de descarga es el mejor ' +
      'momento, porque llegás descansado.',
    semanaPropuesta: null,
    diasModificados: [],
    aplicable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Redacción
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Punto de enganche para una capa de redacción más natural.
 *
 * Hoy devuelve la plantilla tal cual. Cuando se enchufe un LLM que reescriba
 * las explicaciones con más voz, se reemplaza esta función y nada más: la
 * lógica del motor no sabe ni tiene que saber quién redacta.
 *
 * La firma es asíncrona a propósito, para que ese cambio no obligue a tocar a
 * quien la llama.
 */
export type RedactorCoach = (adaptacion: Adaptacion) => Promise<string>;

export const redactarConPlantilla: RedactorCoach = async (adaptacion) => adaptacion.explicacion;

// ─────────────────────────────────────────────────────────────────────────────

/** Índices de los días cuyo tipo cambió entre dos versiones de la semana. */
function diferencias(antes: readonly PlannedDay[], despues: readonly PlannedDay[]): number[] {
  const cambiados: number[] = [];
  for (const dia of despues) {
    const original = antes.find((d) => d.dayIndex === dia.dayIndex);
    if (!original || original.type !== dia.type) cambiados.push(dia.dayIndex);
  }
  return cambiados;
}
