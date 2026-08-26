/**
 * Generación del plan: macrociclo → mesociclos → microciclos.
 *
 * Todo determinista: mismas entradas, mismo plan. Las decisiones salen de las
 * tablas de config.ts y toda semana generada pasa por el validador de rules.ts
 * antes de devolverse.
 */

import {
  COMPRESSION_RISK_THRESHOLD,
  DEFAULT_MESOCYCLE_SCHEME,
  LEVEL_TABLE,
  MACROCYCLE_TABLE,
  MESOCYCLE_SCHEMES,
  MICROCYCLE_TEMPLATES,
  TRAINING_TYPE_TARGETS,
  VOLUME_WEIGHTS,
  type LevelRow,
} from './config';
import { proyectarVolumen, type Agresividad } from './progression';
import { repararMicrociclo, validarSecuencia } from './rules';
import { normalizarDiasDisponibles, plantillaParaDias } from './trainingDays';
import type {
  BasePaceLevel,
  LoadWeek,
  Macrocycle,
  Mesocycle,
  MesocycleScheme,
  Microcycle,
  PlannedDay,
  RaceDistance,
  TrainingType,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Nivel del corredor (Tabla 3)
// ─────────────────────────────────────────────────────────────────────────────

export interface NivelCorredor {
  row: LevelRow;
  daysMin: number;
  daysMax: number;
  /** Días recomendados: el techo del rango, que es lo que la tabla prescribe. */
  diasRecomendados: number;
}

/**
 * Ubica al corredor en la Tabla 3 por el TIEMPO OBJETIVO de su carrera.
 *
 * La tabla va de más lento a más rápido: se toma la primera fila cuyo tiempo
 * objetivo el corredor todavía no supera. Un objetivo más rápido que la última
 * fila cae en la última (6 días).
 */
export function nivelPorObjetivo(
  distance: RaceDistance,
  targetSeconds: number,
): NivelCorredor {
  const row =
    LEVEL_TABLE.find((r) => targetSeconds >= r.targets[distance]) ??
    LEVEL_TABLE[LEVEL_TABLE.length - 1]!;
  return { row, daysMin: row.daysMin, daysMax: row.daysMax, diasRecomendados: row.daysMax };
}

/**
 * ¿Es alcanzable el objetivo en el plazo disponible?
 *
 * Compara las semanas que quedan hasta la carrera contra el plan ideal de la
 * Tabla 6 y devuelve un veredicto con su explicación en español.
 */
export interface Feasibilidad {
  viable: boolean;
  riesgo: 'bajo' | 'medio' | 'alto';
  semanasDisponibles: number;
  semanasIdeales: number;
  mensaje: string;
}

export function feasibilidadObjetivo(
  distance: RaceDistance,
  semanasDisponibles: number,
): Feasibilidad {
  const ideal = MACROCYCLE_TABLE[distance].totalWeeks;
  const ratio = semanasDisponibles / ideal;

  if (ratio >= 1) {
    return {
      viable: true,
      riesgo: 'bajo',
      semanasDisponibles,
      semanasIdeales: ideal,
      mensaje: `Tenés ${semanasDisponibles} semanas y el plan ideal para ${distance} usa ${ideal}. Entrás cómodo.`,
    };
  }
  if (ratio >= COMPRESSION_RISK_THRESHOLD) {
    return {
      viable: true,
      riesgo: 'medio',
      semanasDisponibles,
      semanasIdeales: ideal,
      mensaje:
        `Quedan ${semanasDisponibles} semanas y el plan ideal para ${distance} usa ${ideal}. ` +
        'Se comprime el plan proporcionalmente: vas a llegar, pero con menos margen ante imprevistos.',
    };
  }
  return {
    viable: false,
    riesgo: 'alto',
    semanasDisponibles,
    semanasIdeales: ideal,
    mensaje:
      `Quedan sólo ${semanasDisponibles} semanas contra las ${ideal} del plan ideal para ${distance}. ` +
      'Comprimir tanto multiplica el riesgo de lesión. Conviene correr esta carrera como test y ' +
      'apuntar el objetivo real a una fecha más lejana.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Macrociclo
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjetivoPlan {
  distance: RaceDistance;
  /** Tiempo objetivo en segundos. Ubica al corredor en la Tabla 3. */
  targetSeconds: number;
  /** Fecha de la carrera en ISO (YYYY-MM-DD). */
  raceDate: string;
  /** Fecha de arranque del plan en ISO (YYYY-MM-DD). */
  startDate: string;
  /** Volumen semanal actual del corredor, en km. Es el punto de partida. */
  volumenActualKm: number;
  /** Ritmo base para la Tabla 7. */
  ritmoBase: BasePaceLevel;
  scheme?: MesocycleScheme;
  /** Días de entrenamiento por semana. Por defecto, lo que dice la Tabla 3. */
  diasPorSemana?: number;
  /**
   * Días de la semana en los que el corredor puede entrenar (0 = lunes).
   *
   * Cuando se pasan, mandan sobre `diasPorSemana`: la cantidad de sesiones sale
   * de cuántos días eligió. Es la restricción más dura del plan — un plan que
   * cae en días imposibles no se cumple.
   */
  diasDisponibles?: readonly number[];
  hayFatigaExterna?: boolean;
  agresividad?: Agresividad;
}

/** Semanas completas entre dos fechas ISO. */
export function semanasEntre(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new Error('Las fechas del plan deben estar en formato YYYY-MM-DD.');
  }
  return Math.max(0, Math.floor((end - start) / (7 * 24 * 3600 * 1000)));
}

/**
 * Genera el macrociclo completo.
 *
 * Si la fecha objetivo deja menos semanas que el plan ideal de la Tabla 6, el
 * plan se comprime proporcionalmente (base y total escalan juntas) y se marca
 * el riesgo en `warnings`. Nunca se falla en silencio.
 */
export function generarMacrociclo(objetivo: ObjetivoPlan): Macrocycle {
  const ideal = MACROCYCLE_TABLE[objetivo.distance];
  const disponibles = semanasEntre(objetivo.startDate, objetivo.raceDate);
  const warnings: string[] = [];

  const feasibilidad = feasibilidadObjetivo(objetivo.distance, disponibles);
  if (feasibilidad.riesgo !== 'bajo') warnings.push(feasibilidad.mensaje);

  const compressed = disponibles > 0 && disponibles < ideal.totalWeeks;
  const totalWeeks = compressed ? disponibles : ideal.totalWeeks;
  const ratio = totalWeeks / ideal.totalWeeks;
  const baseWeeks = compressed
    ? Math.max(1, Math.round(ideal.baseWeeks * ratio))
    : ideal.baseWeeks;

  if (disponibles === 0) {
    warnings.push(
      'La fecha de la carrera no deja ninguna semana completa de entrenamiento. ' +
        'Se genera el plan ideal como referencia, sin ajustarlo a esa fecha.',
    );
  }

  const scheme = objetivo.scheme ?? DEFAULT_MESOCYCLE_SCHEME;
  const nivel = nivelPorObjetivo(objetivo.distance, objetivo.targetSeconds);

  // Los días elegidos mandan sobre la Tabla 3: si el corredor dijo que puede
  // cuatro días, el plan es de cuatro días aunque la tabla recomiende cinco.
  const diasElegidos = objetivo.diasDisponibles
    ? normalizarDiasDisponibles(objetivo.diasDisponibles)
    : null;
  const diasPorSemana =
    diasElegidos && diasElegidos.length > 0
      ? diasElegidos.length
      : (objetivo.diasPorSemana ?? nivel.diasRecomendados);

  let plantilla: readonly TrainingType[] | undefined;
  if (diasElegidos && diasElegidos.length > 0) {
    const resultado = plantillaParaDias(diasElegidos);
    plantilla = resultado.plantilla;

    if (!resultado.respetaDiasElegidos) {
      warnings.push(
        'Con los días que elegiste no hay forma de ordenar la semana sin romper las reglas del ' +
          'microciclo (nunca dos Específicos seguidos, ni un Específico después del Largo). ' +
          'El plan se generó con la distribución estándar de la tabla: vas a tener que mover ' +
          'alguna sesión a mano desde el calendario.',
      );
    }

    if (diasPorSemana < nivel.daysMin) {
      warnings.push(
        `Elegiste ${diasPorSemana} días por semana y para tu objetivo la Tabla 3 recomienda ` +
          `entre ${nivel.daysMin} y ${nivel.daysMax}. El plan se genera igual, pero el volumen ` +
          'se reparte en menos sesiones: cada una va a ser más larga de lo habitual.',
      );
    }
  }

  const cargas = secuenciaDeCargas(scheme, totalWeeks);
  const volumenes = proyectarVolumen(
    objetivo.volumenActualKm,
    cargas,
    objetivo.ritmoBase,
    objetivo.distance,
    objetivo.hayFatigaExterna ?? false,
    objetivo.agresividad ?? 'conservador',
  );

  const weeks: Microcycle[] = cargas.map((load, i) =>
    generarMicrociclo({
      weekNumber: i + 1,
      load,
      diasPorSemana,
      volumenObjetivoKm: volumenes[i]!,
      ...(plantilla ? { plantilla } : {}),
    }),
  );

  return {
    distance: objetivo.distance,
    raceDate: objetivo.raceDate,
    startDate: objetivo.startDate,
    baseWeeks,
    totalWeeks,
    postRaceRestWeeks: ideal.restWeeksMin,
    compressed,
    mesocycles: agruparEnMesociclos(weeks, scheme),
    warnings,
  };
}

/** Repite el patrón del esquema hasta cubrir las semanas del macrociclo. */
export function secuenciaDeCargas(
  scheme: MesocycleScheme,
  totalWeeks: number,
): LoadWeek[] {
  const pattern = MESOCYCLE_SCHEMES[scheme].weeks;
  const out: LoadWeek[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    out.push(pattern[i % pattern.length]!);
  }
  return out;
}

/** Parte las semanas en mesociclos del largo que dicte el esquema. */
export function agruparEnMesociclos(
  weeks: readonly Microcycle[],
  scheme: MesocycleScheme,
): Mesocycle[] {
  const size = MESOCYCLE_SCHEMES[scheme].weeks.length;
  const mesocycles: Mesocycle[] = [];
  for (let i = 0; i < weeks.length; i += size) {
    mesocycles.push({
      index: mesocycles.length + 1,
      scheme,
      weeks: weeks.slice(i, i + size),
    });
  }
  return mesocycles;
}

/** Genera un mesociclo suelto, para previsualizar un esquema. */
export function generarMesociclo(params: {
  index: number;
  scheme: MesocycleScheme;
  diasPorSemana: number;
  volumenInicialKm: number;
  ritmoBase: BasePaceLevel;
  objetivo: RaceDistance;
  hayFatigaExterna?: boolean;
  agresividad?: Agresividad;
}): Mesocycle {
  const cargas = MESOCYCLE_SCHEMES[params.scheme].weeks;
  const volumenes = proyectarVolumen(
    params.volumenInicialKm,
    cargas,
    params.ritmoBase,
    params.objetivo,
    params.hayFatigaExterna ?? false,
    params.agresividad ?? 'conservador',
  );

  return {
    index: params.index,
    scheme: params.scheme,
    weeks: cargas.map((load, i) =>
      generarMicrociclo({
        weekNumber: i + 1,
        load,
        diasPorSemana: params.diasPorSemana,
        volumenObjetivoKm: volumenes[i]!,
      }),
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Microciclo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera una semana a partir de la plantilla de la Tabla 4 y reparte el volumen
 * objetivo entre los días que suman km.
 *
 * La semana devuelta SIEMPRE pasa por el validador: si la plantilla se tocó y
 * quedó inválida, se repara antes de devolverla.
 */
export function generarMicrociclo(params: {
  weekNumber: number;
  load: LoadWeek;
  diasPorSemana: number;
  volumenObjetivoKm: number;
  plantilla?: readonly TrainingType[];
}): Microcycle {
  const template = params.plantilla ?? plantillaPara(params.diasPorSemana);
  const days = repartirVolumen(template, params.volumenObjetivoKm);

  const validation = validarSecuencia(days.map((d) => d.type));
  const finalDays = validation.valid ? days : repararMicrociclo(days);

  return {
    weekNumber: params.weekNumber,
    load: params.load,
    days: finalDays,
    totalKm: Math.round(finalDays.reduce((sum, d) => sum + d.km, 0) * 10) / 10,
  };
}

/**
 * Elige la plantilla de la Tabla 4 para una cantidad de días de entrenamiento.
 *
 * La tabla cubre de 3 a 6 días; fuera de ese rango se toma el extremo más
 * cercano, que es lo que la metodología prescribe como piso y techo.
 */
export function plantillaPara(diasPorSemana: number): readonly TrainingType[] {
  const clamped = Math.min(6, Math.max(3, Math.round(diasPorSemana)));
  return MICROCYCLE_TEMPLATES[clamped]!;
}

/**
 * Reparte el volumen semanal entre los días, ponderando por tipo de sesión.
 *
 * El F se lleva la parte grande, el E una media y el R lo mínimo (VOLUME_WEIGHTS).
 * El redondeo a 0.5 km se compensa en el día F para que el total cierre exacto
 * contra el volumen objetivo.
 */
function repartirVolumen(
  template: readonly TrainingType[],
  volumenObjetivoKm: number,
): PlannedDay[] {
  const totalWeight = template.reduce((sum, t) => sum + VOLUME_WEIGHTS[t], 0);

  const days: PlannedDay[] = template.map((type, dayIndex) => {
    const targets = TRAINING_TYPE_TARGETS[type];
    const share = totalWeight > 0 ? VOLUME_WEIGHTS[type] / totalWeight : 0;
    const day: PlannedDay = {
      dayIndex,
      type,
      discipline: 'running',
      km: Math.round(volumenObjetivoKm * share * 2) / 2,
    };
    if (targets.zone !== null) day.targetZone = targets.zone;
    if (targets.rpe !== null) day.targetRpe = targets.rpe;
    return day;
  });

  // El redondeo por día se acumula; se corrige en el largo, que es el que tiene
  // margen para absorber medio km sin cambiar de naturaleza.
  const assigned = days.reduce((sum, d) => sum + d.km, 0);
  const drift = Math.round((volumenObjetivoKm - assigned) * 2) / 2;
  const longRun = days.find((d) => d.type === 'F');
  if (longRun && drift !== 0) {
    longRun.km = Math.max(0, Math.round((longRun.km + drift) * 2) / 2);
  }

  return days;
}
