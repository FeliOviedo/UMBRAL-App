/**
 * TODOS los parámetros de la metodología viven acá.
 *
 * Si un número de la metodología aparece en cualquier otro archivo del proyecto,
 * es un bug: los módulos de dominio leen de este archivo y la UI lee de los
 * módulos de dominio. Así se puede recalibrar la metodología entera tocando un
 * solo lugar, y los tests comparan contra esta fuente única de verdad.
 */

import type {
  BasePaceLevel,
  MesocycleScheme,
  RaceDistance,
  TrainingType,
  ZoneDefinition,
  ZoneId,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Zonas de Joe Friel for Running (7 zonas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las 7 zonas, ancladas a %LTHR, RPE y test del habla.
 *
 * El porcentaje de LTHR es el criterio ORIGINAL de Friel, pero en Umbral la FC
 * es un dato secundario: el reloj del usuario mide mal las pulsaciones. La
 * intensidad se decide por RPE y sensaciones; la FC acompaña cuando es fiable.
 *
 * Sobre los rangos: Friel los enuncia con porcentajes enteros (Z2 85-89, Z3
 * 90-94…) y así se muestran en la UI, vía `lthrLabel`. Para clasificar, en
 * cambio, se usan intervalos semiabiertos [min, max): si se tomaran los enteros
 * al pie de la letra, una FC al 89.5% de la LTHR no caería en ninguna zona.
 * `null` significa "sin límite por ese lado".
 */
export const ZONES: readonly ZoneDefinition[] = [
  {
    id: 'Z1',
    name: 'Recuperación',
    lthrMinPct: null,
    lthrMaxPct: 85,
    lthrLabel: '<85% LTHR',
    rpeMin: 1,
    rpeMax: 3,
    talkTest: 'Muy fácil',
    color: '#5B6B7A',
  },
  {
    id: 'Z2',
    name: 'Aeróbico',
    lthrMinPct: 85,
    lthrMaxPct: 90,
    lthrLabel: '85-89% LTHR',
    rpeMin: 4,
    rpeMax: 5,
    talkTest: 'Conversacional',
    color: '#2FB6C4',
  },
  {
    id: 'Z3',
    name: 'Tempo',
    lthrMinPct: 90,
    lthrMaxPct: 95,
    lthrLabel: '90-94% LTHR',
    rpeMin: 6,
    rpeMax: 6,
    talkTest: 'Incómodo pero sostenible hasta 90 min',
    color: '#54C48A',
  },
  {
    id: 'Z4',
    name: 'Sub-umbral',
    lthrMinPct: 95,
    lthrMaxPct: 100,
    lthrLabel: '95-99% LTHR',
    rpeMin: 7,
    rpeMax: 7,
    talkTest: 'Velocidad controlada, alguna palabra suelta; 40-60 min máx',
    color: '#F2B43D',
  },
  {
    id: 'Z5a',
    name: 'Super-umbral',
    lthrMinPct: 100,
    lthrMaxPct: 103,
    lthrLabel: '100-102% LTHR',
    rpeMin: 8,
    rpeMax: 8,
    talkTest: 'Fuerte sostenido, alguna palabra; 20-25 min',
    color: '#F58A3C',
  },
  {
    id: 'Z5b',
    name: 'Capacidad aeróbica',
    lthrMinPct: 103,
    lthrMaxPct: 106.01,
    lthrLabel: '103-106% LTHR',
    rpeMin: 9,
    rpeMax: 9,
    talkTest: 'Duro, alguna palabra si te esforzás; esfuerzos hasta 4 min',
    color: '#EF5F3C',
  },
  {
    id: 'Z5c',
    name: 'Capacidad anaeróbica',
    lthrMinPct: 106.01,
    lthrMaxPct: null,
    lthrLabel: '>106% LTHR',
    rpeMin: 10,
    rpeMax: 10,
    talkTest: 'Muy duro/máximo; 10 s, no podés hablar',
    color: '#E23B4E',
  },
] as const;

/**
 * Factores para derivar las zonas de pace a partir del pace umbral.
 *
 * Se expresan como multiplicadores del pace umbral en segundos/km. Un factor
 * MAYOR a 1 significa más lento (más segundos por km). `slow`/`fast` son los
 * extremos del rango; `null` = sin límite por ese lado.
 */
export const PACE_ZONE_FACTORS: Readonly<
  Record<ZoneId, { fast: number | null; slow: number | null }>
> = {
  Z1: { fast: 1.29, slow: null },
  Z2: { fast: 1.14, slow: 1.29 },
  Z3: { fast: 1.06, slow: 1.14 },
  Z4: { fast: 1.0, slow: 1.06 },
  Z5a: { fast: 0.97, slow: 1.0 },
  Z5b: { fast: 0.9, slow: 0.97 },
  Z5c: { fast: null, slow: 0.9 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Cálculo del umbral
// ─────────────────────────────────────────────────────────────────────────────

export const THRESHOLD_TEST = {
  /**
   * Test de LTHR: correr 30 min al máximo sostenible y promediar la FC de los
   * últimos 20 min. Ese promedio ES la LTHR, sin corrección.
   */
  lthr30MinCorrection: 1.0,
  /**
   * Variante de 20 min: se le resta un 5% al promedio porque el esfuerzo de 20
   * min queda por encima del umbral real.
   */
  lthr20MinCorrection: 0.95,
  /**
   * Test de pace umbral: correr 20 min constante y tomar el pace promedio. Ese
   * pace se multiplica por 1.05 para obtener la velocidad sostenible 60 min,
   * que es el límite superior de Z4 (el pace umbral propiamente dicho).
   */
  pace20MinFactor: 1.05,
  /** Duración en minutos de cada variante del test de FC. */
  lthrTestMinutes: { long: 30, short: 20 },
  /** Ventana final promediada en el test largo, en minutos. */
  lthrAveragingWindowMinutes: 20,
  /** Duración del test de pace, en minutos. */
  paceTestMinutes: 20,
} as const;

/**
 * Umbral: Umbral NO usa "220 - edad". Esa fórmula tiene un error estándar de
 * ±10-12 bpm y arrastra ese error a las 7 zonas. La app deriva todo del test.
 */
export const REJECT_AGE_BASED_MAX_HR = true;

// ─────────────────────────────────────────────────────────────────────────────
// Tabla 3 — Días por semana según nivel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El nivel del corredor se ubica por el TIEMPO OBJETIVO de la carrera, no por
 * años de experiencia. Cada fila da los tiempos equivalentes en las cuatro
 * distancias y los días de entrenamiento por semana que corresponden.
 *
 * Los tiempos están en segundos. `daysMin`/`daysMax` son iguales cuando la
 * tabla da un valor único (ej. "3" vs "3-4").
 */
export interface LevelRow {
  /** Tiempos objetivo, en segundos, por distancia. */
  targets: Record<RaceDistance, number>;
  daysMin: number;
  daysMax: number;
}

const hms = (h: number, m: number, s: number): number => h * 3600 + m * 60 + s;

export const LEVEL_TABLE: readonly LevelRow[] = [
  {
    targets: {
      '5K': hms(0, 35, 0),
      '10K': hms(1, 15, 0),
      '21K': hms(2, 45, 0),
      '42K': hms(5, 45, 0),
    },
    daysMin: 3,
    daysMax: 3,
  },
  {
    targets: {
      '5K': hms(0, 30, 0),
      '10K': hms(1, 0, 0),
      '21K': hms(2, 20, 0),
      '42K': hms(5, 0, 0),
    },
    daysMin: 3,
    daysMax: 4,
  },
  {
    targets: {
      '5K': hms(0, 25, 0),
      '10K': hms(0, 52, 0),
      '21K': hms(1, 55, 0),
      '42K': hms(4, 0, 0),
    },
    daysMin: 4,
    daysMax: 4,
  },
  {
    targets: {
      '5K': hms(0, 22, 0),
      '10K': hms(0, 45, 0),
      '21K': hms(1, 40, 0),
      '42K': hms(3, 35, 0),
    },
    daysMin: 4,
    daysMax: 5,
  },
  {
    targets: {
      '5K': hms(0, 20, 0),
      '10K': hms(0, 40, 0),
      '21K': hms(1, 30, 0),
      '42K': hms(3, 15, 0),
    },
    daysMin: 5,
    daysMax: 5,
  },
  {
    targets: {
      '5K': hms(0, 17, 0),
      '10K': hms(0, 35, 0),
      '21K': hms(1, 20, 0),
      '42K': hms(2, 45, 0),
    },
    daysMin: 6,
    daysMax: 6,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tabla 4 — Plantillas de microciclo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plantillas base por cantidad de días de entrenamiento por semana.
 *
 * Se transcriben tal cual las da la Tabla 4. Son un punto de partida, no la
 * palabra final: el generador las reordena (los R son comodines) y el validador
 * de rules.ts es el que manda.
 *
 * OJO con la de 6 días: 'R E R E E D F' tiene dos Específicos consecutivos, así
 * que viola R2 tal como viene. No se la corrige acá para no falsear la tabla de
 * origen; `generarMicrociclo` la pasa por `repararMicrociclo`, que la reordena a
 * una secuencia legal con la misma carga. Está cubierto por tests.
 */
export const MICROCYCLE_TEMPLATES: Readonly<Record<number, readonly TrainingType[]>> = {
  3: ['D', 'R', 'D', 'E', 'D', 'D', 'F'],
  4: ['D', 'E', 'D', 'E', 'D', 'R', 'F'],
  5: ['D', 'E', 'R', 'E', 'D', 'R', 'F'],
  6: ['R', 'E', 'R', 'E', 'E', 'D', 'F'],
} as const;

/**
 * Reparto del volumen semanal entre los días que sí suman km.
 *
 * F se lleva la parte grande (es la sesión de volumen), E un porcentaje medio y
 * R lo mínimo. Los pesos se normalizan, así que son relativos, no porcentajes.
 */
export const VOLUME_WEIGHTS: Readonly<Record<TrainingType, number>> = {
  F: 3,
  E: 2,
  R: 1,
  D: 0,
} as const;

/** Zona y RPE objetivo por tipo de entrenamiento. */
export const TRAINING_TYPE_TARGETS: Readonly<
  Record<TrainingType, { zone: ZoneId | null; rpe: number | null; label: string }>
> = {
  F: { zone: 'Z2', rpe: 4, label: 'Largo/Fondo' },
  E: { zone: 'Z4', rpe: 7, label: 'Específico' },
  R: { zone: 'Z1', rpe: 2, label: 'Recuperación' },
  D: { zone: null, rpe: null, label: 'Descanso' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tabla 5 — Cargas del mesociclo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Secuencia de semanas de cada esquema de mesociclo.
 *
 * El nombre del esquema es (semanas de carga):(semanas de descarga). 3:1 es el
 * DEFAULT porque es el que tolera un corredor de nivel bajo/medio sin acumular
 * fatiga; 1:1 sólo para nivel alto.
 */
export const MESOCYCLE_SCHEMES: Readonly<
  Record<MesocycleScheme, { weeks: readonly import('./types').LoadWeek[]; level: string }>
> = {
  '1:1': { weeks: ['carga', 'descarga', 'carga+', 'descarga'], level: 'Alto' },
  '2:1': { weeks: ['carga', 'carga+', 'descarga'], level: 'Medio' },
  '3:1': { weeks: ['carga', 'carga+', 'carga++', 'descarga'], level: 'Bajo' },
} as const;

export const DEFAULT_MESOCYCLE_SCHEME: MesocycleScheme = '3:1';

/** Factor de volumen aplicado a la semana de descarga respecto de la anterior. */
export const DELOAD_VOLUME_FACTOR = 0.8;

// ─────────────────────────────────────────────────────────────────────────────
// Tabla 6 — Macrociclo, base y descanso post-carrera
// ─────────────────────────────────────────────────────────────────────────────

/** Semanas de base, totales y de descanso post-carrera, por distancia. */
export const MACROCYCLE_TABLE: Readonly<
  Record<
    RaceDistance,
    { baseWeeks: number; totalWeeks: number; restWeeksMin: number; restWeeksMax: number }
  >
> = {
  '5K': { baseWeeks: 4, totalWeeks: 16, restWeeksMin: 1, restWeeksMax: 3 },
  '10K': { baseWeeks: 6, totalWeeks: 20, restWeeksMin: 2, restWeeksMax: 4 },
  '21K': { baseWeeks: 8, totalWeeks: 24, restWeeksMin: 3, restWeeksMax: 5 },
  '42K': { baseWeeks: 12, totalWeeks: 28, restWeeksMin: 4, restWeeksMax: 6 },
} as const;

/**
 * Por debajo de esta fracción del plan ideal, comprimir deja de ser razonable y
 * la app marca riesgo alto sobre el objetivo.
 */
export const COMPRESSION_RISK_THRESHOLD = 0.6;

// ─────────────────────────────────────────────────────────────────────────────
// Tabla 7 — Progresión de volumen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Km a sumar por semana de CARGA, según el ritmo base del corredor y la
 * distancia objetivo.
 *
 * Reglas de uso:
 * - En semana de descarga no se suma: se baja (ver DELOAD_VOLUME_FACTOR).
 * - Si hay fatiga externa (fuerza, fútbol, mala semana), se toma SIEMPRE el
 *   límite inferior del rango.
 */
export interface ProgressionRow {
  level: BasePaceLevel;
  label: string;
  /**
   * Velocidad de referencia en km/h, tal como la enuncia la tabla.
   *
   * OJO: la tabla pareja km/h con paces redondeados a mano, así que las dos
   * columnas no son conversiones exactas una de la otra (9 km/h serían 6:40, no
   * 7:00). Se transcriben ambas tal cual; para ubicar al corredor se usa el
   * PACE, que es el dato con el que la gente piensa.
   */
  kmh: number;
  /** Pace de referencia en segundos por km. */
  paceSecPerKm: number;
  /** Rango [min, max] de km a sumar por semana, por distancia objetivo. */
  increments: Record<RaceDistance, readonly [number, number]>;
}

const mmss = (m: number, s: number): number => m * 60 + s;

export const PROGRESSION_TABLE: readonly ProgressionRow[] = [
  {
    level: 'suave',
    label: 'Suave',
    kmh: 9,
    paceSecPerKm: mmss(7, 0),
    increments: { '5K': [1, 2], '10K': [1, 2], '21K': [1, 2], '42K': [1, 2] },
  },
  {
    level: 'promedio',
    label: 'Promedio',
    kmh: 10,
    paceSecPerKm: mmss(6, 0),
    increments: { '5K': [2, 2.5], '10K': [2, 3], '21K': [2, 3], '42K': [2, 4] },
  },
  {
    level: 'moderado',
    label: 'Moderado',
    kmh: 12,
    paceSecPerKm: mmss(5, 0),
    increments: { '5K': [3, 3.5], '10K': [3, 4], '21K': [3, 4], '42K': [3, 5] },
  },
  {
    level: 'fuerte',
    label: 'Fuerte',
    kmh: 13,
    paceSecPerKm: mmss(4, 36),
    increments: { '5K': [4, 4.5], '10K': [4, 5], '21K': [4, 5], '42K': [4, 6] },
  },
  {
    level: 'rapido',
    label: 'Rápido',
    kmh: 15,
    paceSecPerKm: mmss(4, 0),
    increments: { '5K': [5, 6], '10K': [5, 7], '21K': [5, 7], '42K': [5, 8] },
  },
  {
    level: 'ultra',
    label: 'Ultra',
    kmh: 18,
    paceSecPerKm: mmss(3, 24),
    increments: { '5K': [7, 8], '10K': [7, 9], '21K': [7, 9], '42K': [7, 10] },
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Métricas de esfuerzo
// ─────────────────────────────────────────────────────────────────────────────

/** RPE 1-10. Es el input PRINCIPAL de intensidad de cada sesión. */
export const RPE_SCALE: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Caminar sin esfuerzo' },
  { value: 2, label: 'Muy suave' },
  { value: 3, label: 'Suave' },
  { value: 4, label: 'Cómodo, conversacional' },
  { value: 5, label: 'Cómodo pero sostenido' },
  { value: 6, label: 'Algo incómodo' },
  { value: 7, label: 'Incómodo, velocidad controlada' },
  { value: 8, label: 'Fuerte' },
  { value: 9, label: 'Muy fuerte' },
  { value: 10, label: 'Máximo' },
] as const;

/** Sensación general 1-5 (caritas), independiente de la intensidad. */
export const FEELING_SCALE: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Muy mal' },
  { value: 2, label: 'Mal' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Bien' },
  { value: 5, label: 'Muy bien' },
] as const;

/**
 * Protocolo de sensibilización de RPE: bloques guiados por zona para que el
 * usuario calibre su percepción contra referencias objetivas de pace.
 */
export const RPE_CALIBRATION_PROTOCOL: readonly {
  zone: ZoneId;
  minutes: number;
  prompt: string;
}[] = [
  { zone: 'Z1', minutes: 5, prompt: 'Trotá muy suave. Registrá cómo se siente un RPE 2.' },
  { zone: 'Z2', minutes: 10, prompt: 'Sostené un ritmo conversacional. Esto es RPE 4-5.' },
  { zone: 'Z3', minutes: 6, prompt: 'Subí a incómodo pero sostenible. Esto es RPE 6.' },
  { zone: 'Z4', minutes: 4, prompt: 'Velocidad controlada, casi sin hablar. Esto es RPE 7.' },
  { zone: 'Z5a', minutes: 2, prompt: 'Fuerte sostenido. Esto es RPE 8.' },
  { zone: 'Z1', minutes: 5, prompt: 'Volvé a muy suave y cerrá la calibración.' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Importación de archivos
// ─────────────────────────────────────────────────────────────────────────────

export const IMPORT_CONFIG = {
  /** Prioridad de formatos cuando el usuario tiene varios del mismo entreno. */
  formatPriority: ['tcx', 'gpx', 'kml'] as const,
  /** Radio terrestre medio en metros, para Haversine. */
  earthRadiusMeters: 6_371_000,
  /**
   * Si la distancia Haversine y la declarada por el archivo difieren más que
   * esto (fracción), se avisa y se prefiere la declarada: el GPS acumula ruido
   * punto a punto y el reloj suele corregirlo.
   */
  distanceReconciliationTolerance: 0.05,
  /**
   * Saltos de más de este tiempo entre puntos se tratan como pausa: no suman
   * duración en movimiento.
   */
  maxGapSecondsBetweenPoints: 60,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Adaptación (los umbrales del motor; el motor se implementa en la Fase 4)
// ─────────────────────────────────────────────────────────────────────────────

export const ADAPTATION_CONFIG = {
  /** Diferencia de RPE (real - planificado) que dispara sub-recuperación. */
  rpeOvershootThreshold: 2,
  /** Caída de RPE a igual pace en Z2 que se lee como progreso confirmado. */
  rpeImprovementThreshold: 1,
  /** Caída de FC (bpm) a igual pace en Z2 que se lee como progreso, si es fiable. */
  hrImprovementThresholdBpm: 4,
  /** Sensación por debajo de esto se toma como señal de fatiga. */
  poorFeelingThreshold: 2,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Modelo de homeostasis y supercompensación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parámetros del modelo de carga y recuperación.
 *
 * Es un modelo de dos exponenciales —fatiga y forma— del tipo Banister: cada
 * sesión suma un impulso a las dos, la fatiga sube más pero decae más rápido, y
 * la diferencia entre ambas es lo que se lee como "estado".
 *
 * Los valores son deliberadamente conservadores y redondos: no salen de un
 * estudio, salen de que un corredor recreativo se recupera de una sesión dura
 * en 2-3 días y consolida la adaptación en 3-6 semanas. Recalibrarlos es tocar
 * este bloque, y sólo este bloque.
 */
export const HOMEOSTASIS_CONFIG = {
  /** Constante de decaimiento de la fatiga, en días. Corto: se va rápido. */
  fatigaTauDias: 7,
  /** Constante de decaimiento de la forma, en días. Largo: cuesta ganarla y perderla. */
  formaTauDias: 42,
  /**
   * Cuánto pesa una unidad de carga en la fatiga frente a la forma.
   *
   * Mayor a 1 porque, en lo inmediato, una sesión cansa más de lo que mejora:
   * la ganancia aparece cuando la fatiga ya se fue.
   */
  factorFatiga: 2,
  /** Ventana de días hacia atrás que mira el modelo. Más allá el aporte es ruido. */
  ventanaDias: 42,
  /**
   * Umbrales del estado, sobre el balance (forma − fatiga) normalizado por la
   * carga media de las últimas semanas.
   */
  umbralFatigado: -0.35,
  umbralPico: 0.25,
  umbralSobreDescansado: 0.8,
  /**
   * Carga metabólica por debajo de la cual una semana se considera vacía. Sirve
   * para no dividir por cero al normalizar en las primeras semanas.
   */
  cargaMinimaSignificativa: 50,
} as const;

/**
 * Actividades complementarias: cuánta carga metabólica aporta cada una por
 * minuto y a RPE 1.
 *
 * La carga se calcula igual que en running —minutos × RPE— porque la carga
 * metabólica es un concepto UNIFICADO. El factor sólo corrige que una hora de
 * fuerza no cansa igual que una hora de fútbol al mismo RPE percibido.
 */
export const COMPLEMENTARY_ACTIVITIES: readonly {
  id: string;
  label: string;
  discipline: import('./types').Discipline;
  /** Multiplicador sobre la carga base (minutos × RPE). */
  factorCarga: number;
}[] = [
  { id: 'fuerza', label: 'Gimnasio / fuerza', discipline: 'strength', factorCarga: 1.0 },
  { id: 'futbol', label: 'Fútbol', discipline: 'other', factorCarga: 1.2 },
  { id: 'ciclismo', label: 'Bici', discipline: 'other', factorCarga: 0.7 },
  { id: 'natacion', label: 'Natación', discipline: 'other', factorCarga: 0.8 },
  { id: 'otro', label: 'Otra actividad', discipline: 'other', factorCarga: 1.0 },
] as const;
