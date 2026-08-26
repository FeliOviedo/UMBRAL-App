/**
 * Tipos del dominio de Umbral.
 *
 * Regla de oro: acá no hay nada de UI ni de acceso a datos. Todo lo que se
 * declara en este archivo describe la metodología de entrenamiento y los
 * artefactos que produce el motor de reglas.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Disciplinas y sesiones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Umbral es multidisciplina por diseño. El MVP sólo implementa 'running', pero
 * el modelo de datos y los tipos ya contemplan el resto: cualquier sesión, sea
 * de la disciplina que sea, aporta carga metabólica al modelo de homeostasis.
 */
export type Discipline = 'running' | 'strength' | 'other';

/** Tipos de entrenamiento de la metodología. */
export type TrainingType =
  | 'F' // Largo/Fondo: aeróbico, volumen. 30 min a varias horas. Z1-Z2.
  | 'E' // Específico: intervalos/series. 20 min a 1h30. Z3-Z5.
  | 'R' // Recuperación activa. 5 min a 1h. Z1 estricto.
  | 'D'; // Descanso pasivo. Sin carga.

/** Distancias objetivo soportadas. */
export type RaceDistance = '5K' | '10K' | '21K' | '42K';

// ─────────────────────────────────────────────────────────────────────────────
// Zonas
// ─────────────────────────────────────────────────────────────────────────────

export type ZoneId = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5a' | 'Z5b' | 'Z5c';

/**
 * Definición metodológica de una zona (Joe Friel for Running).
 *
 * Cada zona se ancla a TRES referencias porque la FC del reloj es poco fiable:
 * porcentaje de LTHR, rango de RPE y el "test del habla". El RPE manda.
 */
export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  /** Límite inferior de %LTHR, INCLUSIVE. `null` = sin piso (Z1). */
  lthrMinPct: number | null;
  /**
   * Límite superior de %LTHR, EXCLUSIVE. `null` = sin techo (Z5c).
   *
   * El intervalo es semiabierto —[min, max)— a propósito: con los porcentajes
   * enteros de Friel (Z2 85-89, Z3 90-94…) queda un hueco entre 89% y 90% donde
   * ninguna zona clasifica. El techo exclusivo de cada zona es el piso de la
   * siguiente, así que la recta queda cubierta sin solapamientos.
   */
  lthrMaxPct: number | null;
  /** Etiqueta del rango tal como la enuncia Friel, para mostrar en la UI. */
  lthrLabel: string;
  /** Rango de RPE 1-10 asociado a la zona, inclusive en ambos extremos. */
  rpeMin: number;
  rpeMax: number;
  /** Descripción del test del habla, en español, tal como se muestra en la UI. */
  talkTest: string;
  /** Color de la zona en la identidad visual. */
  color: string;
}

/** Zona con sus rangos de FC ya resueltos en pulsaciones por minuto. */
export interface HeartRateZone extends ZoneDefinition {
  /** bpm mínimo, inclusive. `null` = sin piso. */
  bpmMin: number | null;
  /** bpm máximo, inclusive. `null` = sin techo. */
  bpmMax: number | null;
}

/**
 * Zona con sus rangos de pace resueltos en segundos por km.
 *
 * Ojo con la orientación: un pace más rápido es un número MENOR. `secPerKmFast`
 * es el extremo rápido del rango y `secPerKmSlow` el lento.
 */
export interface PaceZone extends ZoneDefinition {
  /** Extremo rápido (segundos/km, número menor). `null` = sin límite. */
  secPerKmFast: number | null;
  /** Extremo lento (segundos/km, número mayor). `null` = sin límite. */
  secPerKmSlow: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Importación de archivos
// ─────────────────────────────────────────────────────────────────────────────

export type TrackFileFormat = 'tcx' | 'gpx' | 'kml';

/** Punto de la traza. Sólo lat/lon/time están garantizados en los tres formatos. */
export interface TrackPoint {
  lat: number;
  lon: number;
  /** Marca de tiempo en ms epoch. */
  time: number;
  /** Altitud en metros, si el archivo la trae. */
  elevation?: number;
  /** FC instantánea, si el archivo la trae por punto (raro en relojes baratos). */
  heartRate?: number;
}

/** Un kilómetro completo de la actividad. */
export interface Split {
  /** Número de km, empezando en 1. */
  km: number;
  /** Duración de ese km en segundos. */
  seconds: number;
  /** Pace del km en segundos por km. */
  paceSecPerKm: number;
  /** Metros reales acumulados en el tramo (el último split puede ser parcial). */
  meters: number;
}

/**
 * Datos de resumen que trae el Lap de un TCX.
 *
 * Nota real de campo: los TCX del creator "Mi Fitness"/Xiaomi traen la FC sólo
 * como UN valor promedio de Lap, no como serie por trackpoint. Por eso el
 * análisis Pace-FC de Umbral trabaja a nivel de SESIÓN, no punto a punto — que
 * es justo lo que la metodología pide para el ciclo de base.
 */
export interface LapSummary {
  distanceMeters?: number;
  totalTimeSeconds?: number;
  calories?: number;
  /** FC promedio de la sesión. */
  averageHeartRateBpm?: number;
  /** FC máxima del lap, si viene. */
  maximumHeartRateBpm?: number;
  /** Velocidad media en m/s. */
  averageSpeedMps?: number;
  /** Pasos totales del lap; de acá se deriva la cadencia media. */
  steps?: number;
}

/** Resultado normalizado de importar un archivo, sea cual sea su formato. */
export interface ImportedActivity {
  format: TrackFileFormat;
  /** Identificador del dispositivo/app que generó el archivo, si se declara. */
  creator?: string;
  /** Inicio de la actividad en ms epoch. */
  startedAt?: number;
  points: TrackPoint[];
  /** Distancia final, ya reconciliada entre el cálculo Haversine y el archivo. */
  distanceMeters: number;
  /** Distancia calculada por Haversine sobre los puntos. */
  computedDistanceMeters: number;
  /** Distancia declarada por el archivo, si la declara. */
  declaredDistanceMeters?: number;
  durationSeconds: number;
  /** Pace medio en segundos por km. `null` si no hay distancia. */
  paceSecPerKm: number | null;
  splits: Split[];
  /** Cadencia media en pasos por minuto, derivada de `steps`. */
  cadenceSpm?: number;
  /** Resumen del lap; sólo TCX lo provee. */
  lap?: LapSummary;
  /** Avisos no fatales del parseo (campos ausentes, distancias discrepantes…). */
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Planificación
// ─────────────────────────────────────────────────────────────────────────────

/** Esquema de carga del mesociclo (Tabla 5). */
export type MesocycleScheme = '1:1' | '2:1' | '3:1';

/** Ritmo base del corredor, usado para la progresión de volumen (Tabla 7). */
export type BasePaceLevel = 'suave' | 'promedio' | 'moderado' | 'fuerte' | 'rapido' | 'ultra';

/** Un día del microciclo. */
export interface PlannedDay {
  /** 0 = primer día de la semana del plan. */
  dayIndex: number;
  type: TrainingType;
  discipline: Discipline;
  /** Km planificados para el día. 0 para D. */
  km: number;
  /** Zona objetivo dominante de la sesión. */
  targetZone?: ZoneId;
  /** RPE objetivo de la sesión — el ancla principal de intensidad. */
  targetRpe?: number;
  notes?: string;
}

/** Una semana del plan. */
export interface Microcycle {
  /** Número de semana dentro del macrociclo, empezando en 1. */
  weekNumber: number;
  /** Rol de la semana dentro del mesociclo. */
  load: LoadWeek;
  days: PlannedDay[];
  /** Volumen total planificado en km. */
  totalKm: number;
}

/** Rol de carga de una semana dentro del mesociclo (Tabla 5). */
export type LoadWeek = 'carga' | 'carga+' | 'carga++' | 'descarga';

export interface Mesocycle {
  /** Número de mesociclo dentro del macrociclo, empezando en 1. */
  index: number;
  scheme: MesocycleScheme;
  weeks: Microcycle[];
}

export interface Macrocycle {
  distance: RaceDistance;
  /** Fecha objetivo de la carrera, en ISO (YYYY-MM-DD). */
  raceDate: string;
  /** Fecha de arranque del plan, en ISO (YYYY-MM-DD). */
  startDate: string;
  /** Semanas de base. */
  baseWeeks: number;
  /** Semanas totales del plan. */
  totalWeeks: number;
  /** Semanas de descanso post-carrera recomendadas. */
  postRaceRestWeeks: number;
  /** true si hubo que comprimir el plan porque la fecha deja menos semanas. */
  compressed: boolean;
  mesocycles: Mesocycle[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación del microciclo
// ─────────────────────────────────────────────────────────────────────────────

/** Identificadores de las reglas inquebrantables del microciclo. */
export type RuleId = 'R1' | 'R2' | 'R3' | 'R4';

export interface RuleViolation {
  rule: RuleId;
  /** Índice del día donde se detecta la violación. -1 si es de la semana entera. */
  dayIndex: number;
  /** Explicación en español, lista para mostrar al usuario. */
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
}
