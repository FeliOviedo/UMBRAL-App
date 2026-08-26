/**
 * Reglas inquebrantables del microciclo.
 *
 * Ninguna semana generada, reordenada o adaptada puede violarlas. Es el
 * guardián del motor: si `validarMicrociclo` dice que no, la semana no se
 * publica.
 *
 *   R1: después de F, sólo R o D (nunca E).
 *   R2: prohibido dos E consecutivos (siempre R o D en medio).
 *   R3: los R son comodines — se pueden mover de día para reparar la semana.
 *   R4: mínimo 1 D absoluto por semana.
 */

import type { PlannedDay, RuleViolation, TrainingType, ValidationResult } from './types';

/** Aplica R1, R2 y R4 sobre la secuencia de tipos de una semana. */
export function validarSecuencia(types: readonly TrainingType[]): ValidationResult {
  const violations: RuleViolation[] = [];

  for (let i = 1; i < types.length; i++) {
    const prev = types[i - 1]!;
    const curr = types[i]!;

    if (prev === 'F' && curr === 'E') {
      violations.push({
        rule: 'R1',
        dayIndex: i,
        message:
          'Después de un Largo/Fondo no puede venir un Específico: ese día tiene ' +
          'que ser Recuperación o Descanso.',
      });
    }

    if (prev === 'E' && curr === 'E') {
      violations.push({
        rule: 'R2',
        dayIndex: i,
        message:
          'No puede haber dos Específicos seguidos: entre uno y otro siempre va ' +
          'Recuperación o Descanso.',
      });
    }
  }

  if (!types.includes('D')) {
    violations.push({
      rule: 'R4',
      dayIndex: -1,
      message: 'La semana necesita al menos un día de Descanso pasivo absoluto.',
    });
  }

  return { valid: violations.length === 0, violations };
}

/** Valida una semana ya armada con sus días. */
export function validarMicrociclo(days: readonly PlannedDay[]): ValidationResult {
  return validarSecuencia(days.map((d) => d.type));
}

/**
 * Repara una semana que viola las reglas, reordenando los días.
 *
 * Estrategia: los R (y los D sobrantes) son comodines (R3), así que se los usa
 * como separadores. Se recorre la semana colocando primero las sesiones duras
 * en posiciones legales e intercalando comodines donde haga falta.
 *
 * Se preserva la CANTIDAD de cada tipo: reparar no cambia la carga de la
 * semana, sólo el orden. Si la composición es imposible de ordenar (más E que
 * separadores disponibles), se devuelve el mejor esfuerzo y el resultado sigue
 * marcado como inválido — el llamador tiene que decidir, no el reparador.
 */
export function repararMicrociclo(days: readonly PlannedDay[]): PlannedDay[] {
  const ordered = ordenarTipos(days.map((d) => d.type));

  // Se reparten los días originales sobre el nuevo orden, tipo por tipo, para
  // no perder los km ni las notas que ya traía cada sesión.
  const byType = new Map<TrainingType, PlannedDay[]>();
  for (const day of days) {
    const list = byType.get(day.type) ?? [];
    list.push(day);
    byType.set(day.type, list);
  }

  return ordered.map((type, index) => {
    const source = byType.get(type)!.shift()!;
    return { ...source, dayIndex: index };
  });
}

/**
 * Ordena una multiconjunto de tipos respetando R1, R2 y R4.
 *
 * Se colocan los E y F separados por comodines: se emite una sesión dura,
 * después un separador, y así. Los sobrantes se agregan al final, que es
 * siempre una posición legal para R y D.
 */
function ordenarTipos(types: readonly TrainingType[]): TrainingType[] {
  const counts: Record<TrainingType, number> = { F: 0, E: 0, R: 0, D: 0 };
  for (const t of types) counts[t] += 1;

  // R4: se reserva un D antes de repartir, para garantizar el descanso absoluto.
  const reservedRest: TrainingType[] = counts.D > 0 ? ['D'] : [];
  if (counts.D > 0) counts.D -= 1;

  const hard: TrainingType[] = [
    ...Array<TrainingType>(counts.E).fill('E'),
    // El F va último entre las duras: así R1 sólo restringe la cola de la semana,
    // que es donde sobran comodines.
    ...Array<TrainingType>(counts.F).fill('F'),
  ];
  const wildcards: TrainingType[] = [
    ...Array<TrainingType>(counts.R).fill('R'),
    ...Array<TrainingType>(counts.D).fill('D'),
  ];

  const result: TrainingType[] = [];
  for (let i = 0; i < hard.length; i++) {
    result.push(hard[i]!);
    // Separador entre duras consecutivas (R2) y después de la F (R1).
    const needsSeparator = i < hard.length - 1;
    if (needsSeparator && wildcards.length > 0) {
      result.push(wildcards.shift()!);
    } else if (needsSeparator) {
      // Sin comodines disponibles la semana es irreparable; se emite igual y
      // validarSecuencia lo va a marcar.
      continue;
    }
  }

  return [...result, ...wildcards, ...reservedRest];
}

/**
 * Reordena la semana cuando el usuario se saltea una sesión.
 *
 * El día omitido se descarta y el resto se reacomoda con las mismas reglas: es
 * el caso 1 del motor de adaptación.
 */
export function reordenarPorSesionOmitida(
  days: readonly PlannedDay[],
  omittedDayIndex: number,
): PlannedDay[] {
  const remaining = days.filter((d) => d.dayIndex !== omittedDayIndex);
  return repararMicrociclo(remaining);
}

/** Explica en español por qué una semana es válida o no. Para la UI de coaching. */
export function explicarValidacion(result: ValidationResult): string {
  if (result.valid) return 'La semana respeta las cuatro reglas del microciclo.';
  return result.violations.map((v) => `${v.rule}: ${v.message}`).join(' ');
}
