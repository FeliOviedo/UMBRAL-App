/**
 * Edición manual del plan: mover una sesión de un día a otro.
 *
 * El motor de adaptación reordena la semana solo, pero hay razones que el
 * motor no puede saber —un viaje, un asado, una lluvia— y para eso está esto:
 * que la persona arrastre la sesión al día que le sirve.
 *
 * Dos decisiones de fondo:
 *
 * 1. **Mover es intercambiar.** Si en el día destino ya hay algo (aunque sea un
 *    Descanso), las dos posiciones se permutan en lugar de pisarse. Así la
 *    semana conserva exactamente la misma composición —los mismos km, las
 *    mismas sesiones— y mover nunca puede cambiar la carga por accidente.
 *
 * 2. **Se valida pero no se prohíbe.** El resultado viene con las violaciones
 *    de R1-R4 que provoque, explicadas en español, y el llamador decide. El
 *    motor automático nunca publica una semana inválida; una persona que sabe
 *    lo que hace, sí puede — pero enterándose.
 *
 * Es lógica pura: trabaja sobre estructuras mínimas, no sobre filas de la base.
 */

import { validarSecuencia } from './rules';
import type { RuleViolation, TrainingType } from './types';

export interface DiaMovible {
  id: string;
  semanaId: string;
  /** 0 = lunes de esa semana. */
  diaIndex: number;
  fecha: string;
  tipo: TrainingType;
}

export interface SemanaMovible {
  id: string;
  /** Lunes de la semana, en ISO. */
  fechaInicio: string;
  dias: readonly DiaMovible[];
}

/** Un día que cambia de lugar. Es lo que la capa de datos tiene que persistir. */
export interface MovimientoDia {
  id: string;
  semanaId: string;
  diaIndex: number;
  fecha: string;
}

export interface ResultadoMovimiento {
  movimientos: MovimientoDia[];
  /** Ids de las semanas cuyo contenido cambió (una, o dos si cruzó de semana). */
  semanasAfectadas: string[];
  violaciones: RuleViolation[];
  /** Explicación en español, siempre presente. */
  mensaje: string;
  /** true si intercambió con otra sesión en vez de caer en un hueco. */
  intercambio: boolean;
}

/** Días enteros entre dos fechas ISO. */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((b - a) / (24 * 3600 * 1000));
}

/** La semana del plan que contiene esa fecha, o null si cae fuera. */
export function semanaDeLaFecha(
  semanas: readonly SemanaMovible[],
  fecha: string,
): SemanaMovible | null {
  return (
    semanas.find((s) => {
      const offset = diasEntre(s.fechaInicio, fecha);
      return offset >= 0 && offset <= 6;
    }) ?? null
  );
}

/**
 * Calcula el movimiento de un día a una fecha nueva.
 *
 * Devuelve `null` si el día no existe o si la fecha destino cae fuera del plan
 * — no se inventan semanas: el plan cierra contra la fecha de la carrera y
 * estirarlo por un arrastre sería cambiar la metodología sin decirlo.
 */
export function planearMovimiento(
  semanas: readonly SemanaMovible[],
  diaId: string,
  nuevaFecha: string,
): ResultadoMovimiento | null {
  const origen = semanas.flatMap((s) => s.dias).find((d) => d.id === diaId);
  if (!origen) return null;

  const semanaDestino = semanaDeLaFecha(semanas, nuevaFecha);
  if (!semanaDestino) return null;

  const indiceDestino = diasEntre(semanaDestino.fechaInicio, nuevaFecha);
  const ocupante = semanaDestino.dias.find((d) => d.diaIndex === indiceDestino) ?? null;

  if (ocupante && ocupante.id === origen.id) {
    return {
      movimientos: [],
      semanasAfectadas: [],
      violaciones: [],
      mensaje: 'La sesión ya estaba en ese día.',
      intercambio: false,
    };
  }

  const semanaOrigen = semanas.find((s) => s.id === origen.semanaId)!;

  const movimientos: MovimientoDia[] = [
    {
      id: origen.id,
      semanaId: semanaDestino.id,
      diaIndex: indiceDestino,
      fecha: nuevaFecha,
    },
  ];

  // El ocupante se va al lugar que dejó el que se movió.
  if (ocupante) {
    movimientos.push({
      id: ocupante.id,
      semanaId: semanaOrigen.id,
      diaIndex: origen.diaIndex,
      fecha: origen.fecha,
    });
  }

  const semanasAfectadas = [...new Set([semanaOrigen.id, semanaDestino.id])];
  const violaciones = violacionesTrasMover(semanas, movimientos, semanasAfectadas);

  return {
    movimientos,
    semanasAfectadas,
    violaciones,
    mensaje: explicarMovimiento(origen, ocupante, nuevaFecha, violaciones),
    intercambio: ocupante !== null,
  };
}

/** Aplica los movimientos en memoria y valida las semanas tocadas. */
function violacionesTrasMover(
  semanas: readonly SemanaMovible[],
  movimientos: readonly MovimientoDia[],
  semanasAfectadas: readonly string[],
): RuleViolation[] {
  const porId = new Map(movimientos.map((m) => [m.id, m]));

  const violaciones: RuleViolation[] = [];
  for (const semanaId of semanasAfectadas) {
    // Los días de esta semana DESPUÉS del movimiento: los que se quedaron más
    // los que aterrizaron acá.
    const dias = semanas
      .flatMap((s) => s.dias)
      .map((d) => {
        const mov = porId.get(d.id);
        return mov ? { ...d, semanaId: mov.semanaId, diaIndex: mov.diaIndex } : d;
      })
      .filter((d) => d.semanaId === semanaId)
      .sort((a, b) => a.diaIndex - b.diaIndex);

    violaciones.push(...validarSecuencia(dias.map((d) => d.tipo)).violations);
  }

  return violaciones;
}

const NOMBRE_TIPO: Record<TrainingType, string> = {
  F: 'el Largo',
  E: 'el Específico',
  R: 'la Recuperación',
  D: 'el Descanso',
};

function explicarMovimiento(
  origen: DiaMovible,
  ocupante: DiaMovible | null,
  nuevaFecha: string,
  violaciones: readonly RuleViolation[],
): string {
  const base = ocupante
    ? `Se intercambia ${NOMBRE_TIPO[origen.tipo]} con ${NOMBRE_TIPO[ocupante.tipo]} del ${nuevaFecha}.`
    : `Se mueve ${NOMBRE_TIPO[origen.tipo]} al ${nuevaFecha}.`;

  if (violaciones.length === 0) {
    return `${base} La semana sigue respetando las cuatro reglas del microciclo.`;
  }

  const reglas = [...new Set(violaciones.map((v) => v.rule))].join(' y ');
  return `${base} Ojo: así queda, la semana rompe ${reglas}. ${violaciones
    .map((v) => v.message)
    .join(' ')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adelantar el plan: saltear semanas o un mesociclo entero
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanaDelPlan {
  id: string;
  numero: number;
  mesociclo: number;
  fechaInicio: string;
  dias: readonly { id: string; diaIndex: number }[];
}

export interface SaltoDePlan {
  /** Semanas que se eliminan del plan. */
  semanasEliminadas: string[];
  /** Semanas que se corren hacia atrás, con su nueva fecha de inicio. */
  semanasRecalendarizadas: { id: string; fechaInicio: string }[];
  /** Días que cambian de fecha por el corrimiento. */
  diasRecalendarizados: { id: string; fecha: string }[];
  /** Cuántas semanas se sacaron del plan. */
  semanasSalteadas: number;
  mensaje: string;
}

/** Suma días a una fecha ISO sin pasar por la zona horaria local. */
function sumarDiasIso(fecha: string, dias: number): string {
  const t = Date.parse(`${fecha}T00:00:00Z`) + dias * 24 * 3600 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Adelanta el plan salteando las semanas que todavía no empezaron de un
 * mesociclo.
 *
 * Qué hace y por qué así:
 *
 * - **Sólo saltea lo que no arrancó.** Las semanas ya vividas son historia; el
 *   plan describe el futuro, no lo reescribe hacia atrás.
 * - **No deja hueco.** Todo lo que viene después se corre hacia atrás tantas
 *   semanas como se hayan salteado, así el plan sigue cerrando contra la fecha
 *   de la carrera en vez de terminar antes y dejar semanas sueltas al final.
 * - **No toca la composición de las semanas que quedan.** Adelantar cambia
 *   CUÁNDO, no QUÉ: las semanas que sobreviven llegan intactas, con su carga y
 *   su orden. Por eso no hace falta revalidar R1-R4 acá.
 *
 * Devuelve `null` si no hay nada que saltear (el mesociclo ya pasó entero).
 */
export function planearSaltoDeMesociclo(
  semanas: readonly SemanaDelPlan[],
  mesocicloIndex: number,
  hoy: string,
): SaltoDePlan | null {
  const ordenadas = [...semanas].sort((a, b) => a.numero - b.numero);

  // "Todavía no arrancó" = su lunes es posterior a hoy. La semana en curso no
  // se saltea: ya se entrenó parte de ella.
  const aSaltear = ordenadas.filter((s) => s.mesociclo === mesocicloIndex && s.fechaInicio > hoy);
  if (aSaltear.length === 0) return null;

  const corrimiento = aSaltear.length * 7;
  const ultimaSalteada = aSaltear[aSaltear.length - 1]!;
  const idsSalteadas = new Set(aSaltear.map((s) => s.id));

  const posteriores = ordenadas.filter(
    (s) => !idsSalteadas.has(s.id) && s.fechaInicio > ultimaSalteada.fechaInicio,
  );

  const semanasRecalendarizadas = posteriores.map((s) => ({
    id: s.id,
    fechaInicio: sumarDiasIso(s.fechaInicio, -corrimiento),
  }));

  const diasRecalendarizados = posteriores.flatMap((s) =>
    s.dias.map((d) => ({
      id: d.id,
      fecha: sumarDiasIso(sumarDiasIso(s.fechaInicio, -corrimiento), d.diaIndex),
    })),
  );

  return {
    semanasEliminadas: [...idsSalteadas],
    semanasRecalendarizadas,
    diasRecalendarizados,
    semanasSalteadas: aSaltear.length,
    mensaje:
      `Se saltean ${aSaltear.length} ${aSaltear.length === 1 ? 'semana' : 'semanas'} del ` +
      `mesociclo ${mesocicloIndex} y el resto del plan se adelanta ${aSaltear.length} ` +
      `${aSaltear.length === 1 ? 'semana' : 'semanas'}. ` +
      'Adelantar salta carga acumulada: el volumen que viene va a sentirse más exigente de lo ' +
      'que se sentiría con el plan completo.',
  };
}
