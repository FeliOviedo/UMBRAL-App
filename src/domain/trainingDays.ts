/**
 * Días de entrenamiento elegidos por el corredor.
 *
 * La Tabla 4 prescribe CUÁNTAS sesiones tiene la semana y en qué orden, pero
 * asume que los días caen donde la plantilla los pone. En la vida real el
 * corredor tiene días fijos que no puede mover: trabaja, juega al fútbol los
 * martes, tiene a los chicos los jueves.
 *
 * Este módulo acomoda las sesiones de la plantilla sobre los días que la
 * persona sí tiene disponibles, sin romper R1-R4. Es una función pura: mismas
 * entradas, misma semana.
 *
 * La decisión de fondo: se respeta la COMPOSICIÓN de la plantilla (cuántas E,
 * cuántas R, una F) y se negocia el ORDEN. Al revés —mover una sesión a un día
 * que la persona no tiene— el plan sería correcto en el papel e imposible en la
 * práctica, que es la forma más común de que un plan se abandone.
 */

import { MICROCYCLE_TEMPLATES } from './config';
import { validarSecuencia } from './rules';
import type { TrainingType } from './types';

/** Índice de día de la semana: 0 = lunes … 6 = domingo. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Mínimo y máximo de días entrenables por semana.
 *
 * El piso (3) es el de la Tabla 4: con menos de tres sesiones no hay estímulo
 * suficiente para sostener una progresión. El techo (6) no es de la tabla sino
 * de R4: la semana necesita al menos un Descanso absoluto, así que entrenar los
 * siete días es directamente inexpresable en esta metodología.
 */
export const MIN_DIAS_ENTRENAMIENTO = 3;
export const MAX_DIAS_ENTRENAMIENTO = 6;

export const NOMBRES_DIA: readonly string[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

/** Los siete días, para armar selectores. */
export const DIAS_SEMANA_INDICES: readonly DiaSemana[] = [0, 1, 2, 3, 4, 5, 6];

export interface ValidacionDias {
  valido: boolean;
  mensaje: string;
}

/** Valida una selección de días antes de generar el plan. */
export function validarDiasDisponibles(dias: readonly number[]): ValidacionDias {
  const unicos = new Set(dias);

  if (unicos.size !== dias.length) {
    return { valido: false, mensaje: 'Hay días repetidos en la selección.' };
  }
  if (dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { valido: false, mensaje: 'Los días tienen que estar entre lunes y domingo.' };
  }
  if (unicos.size < MIN_DIAS_ENTRENAMIENTO) {
    return {
      valido: false,
      mensaje:
        `Elegí al menos ${MIN_DIAS_ENTRENAMIENTO} días. Con menos sesiones por semana no hay ` +
        'estímulo suficiente para sostener la progresión de volumen.',
    };
  }
  if (unicos.size > MAX_DIAS_ENTRENAMIENTO) {
    return {
      valido: false,
      mensaje:
        `Como mucho ${MAX_DIAS_ENTRENAMIENTO} días: la semana necesita al menos un día de ` +
        'Descanso absoluto (R4), así que entrenar los siete no es una opción.',
    };
  }
  return { valido: true, mensaje: 'Selección válida.' };
}

/** Normaliza: ordena, deduplica y recorta al rango entrenable. */
export function normalizarDiasDisponibles(dias: readonly number[]): DiaSemana[] {
  const unicos = [...new Set(dias)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b) as DiaSemana[];
  return unicos.slice(0, MAX_DIAS_ENTRENAMIENTO);
}

/**
 * Distribución sugerida para una cantidad de días por semana.
 *
 * Es lo que se propone cuando alguien dice "puedo entrenar 4 días" sin
 * especificar cuáles. El criterio es separar las sesiones lo más parejo
 * posible y dejar el Largo el fin de semana, que es cuando hay tiempo:
 *
 *   3 → lunes, miércoles, sábado
 *   4 → lunes, miércoles, viernes, domingo
 *   5 → lunes, martes, jueves, viernes, domingo
 *   6 → lunes a sábado
 *
 * Son sugerencias, no imposiciones: el selector deja mover cualquier día
 * después. Están cubiertas por test para que todas produzcan una semana legal.
 */
const DISTRIBUCIONES_SUGERIDAS: Readonly<Record<number, readonly DiaSemana[]>> = {
  3: [0, 2, 5],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 3, 4, 5],
} as const;

export function diasSugeridosPara(cantidad: number): DiaSemana[] {
  const clamped = Math.min(
    MAX_DIAS_ENTRENAMIENTO,
    Math.max(MIN_DIAS_ENTRENAMIENTO, Math.round(cantidad)),
  );
  return [...DISTRIBUCIONES_SUGERIDAS[clamped]!];
}

/**
 * Las sesiones (los días que NO son Descanso) de la plantilla de N días.
 *
 * Se conserva el orden de la Tabla 4 porque ese orden ya codifica la
 * alternancia dura/suave que la metodología quiere; el acomodador de abajo lo
 * usa como punto de partida y sólo lo altera si los días elegidos lo obligan.
 */
export function sesionesDePlantilla(cantidadDias: number): TrainingType[] {
  const clamped = Math.min(
    MAX_DIAS_ENTRENAMIENTO,
    Math.max(MIN_DIAS_ENTRENAMIENTO, Math.round(cantidadDias)),
  );
  return MICROCYCLE_TEMPLATES[clamped]!.filter((t) => t !== 'D');
}

/**
 * Coloca las sesiones sobre los días elegidos y devuelve la semana de 7 slots.
 *
 * Devuelve `null` si no existe ningún orden legal, que en la práctica sólo pasa
 * con selecciones degeneradas (por ejemplo, más Específicos que separadores
 * posibles). El llamador decide qué hacer; acá no se inventa una semana
 * inválida ni se cambia la carga en silencio.
 *
 * Búsqueda: backtracking sobre el multiconjunto de tipos. Son como mucho 6
 * sesiones de 3 tipos distintos, así que el espacio es diminuto y la primera
 * solución encontrada es determinista (se prueban los tipos siempre en el mismo
 * orden), que es lo que el dominio necesita.
 */
export function acomodarSesionesEnDias(
  sesiones: readonly TrainingType[],
  diasDisponibles: readonly number[],
): TrainingType[] | null {
  const dias = normalizarDiasDisponibles(diasDisponibles);
  if (dias.length === 0) return null;
  if (sesiones.length > dias.length) return null;

  const conteo: Record<TrainingType, number> = { F: 0, E: 0, R: 0, D: 0 };
  for (const s of sesiones) conteo[s] += 1;

  // Si sobran días elegidos respecto de las sesiones, los que sobren quedan
  // como Descanso: tener el día disponible no obliga a entrenarlo.
  const semana: TrainingType[] = Array<TrainingType>(7).fill('D');

  // Orden de prueba fijo → resultado determinista.
  const ordenTipos: TrainingType[] = ['E', 'F', 'R'];

  const colocar = (i: number): boolean => {
    if (i === dias.length) {
      return validarSecuencia(semana).valid;
    }

    const restantes = ordenTipos.reduce((sum, t) => sum + conteo[t], 0);
    // Los días sobrantes se dejan en Descanso y se sigue.
    if (restantes === 0) {
      return validarSecuencia(semana).valid;
    }

    for (const tipo of ordenTipos) {
      if (conteo[tipo] === 0) continue;

      conteo[tipo] -= 1;
      semana[dias[i]!] = tipo;

      // Poda: si el prefijo ya viola R1/R2 no hace falta seguir por esta rama.
      if (prefijoViable(semana, dias[i]!) && colocar(i + 1)) return true;

      semana[dias[i]!] = 'D';
      conteo[tipo] += 1;
    }

    return false;
  };

  return colocar(0) ? [...semana] : null;
}

/**
 * ¿El prefijo hasta `hasta` puede todavía llegar a ser una semana legal?
 *
 * Sólo chequea las reglas de adyacencia (R1 y R2) sobre lo ya colocado. R4 se
 * verifica al final, porque un prefijo sin D todavía puede terminar teniéndolo.
 */
function prefijoViable(semana: readonly TrainingType[], hasta: number): boolean {
  for (let i = 1; i <= hasta; i++) {
    const prev = semana[i - 1]!;
    const curr = semana[i]!;
    if (prev === 'F' && curr === 'E') return false;
    if (prev === 'E' && curr === 'E') return false;
  }
  return true;
}

/**
 * La plantilla de 7 slots para una selección de días.
 *
 * Es el punto de entrada que usa el planificador: toma los días elegidos,
 * saca la composición de la Tabla 4 para esa cantidad y la acomoda.
 *
 * Si no hay orden legal, cae a la plantilla original de la tabla: es preferible
 * un plan en los días "de fábrica" —que el corredor va a tener que mover a
 * mano— antes que ninguno. El planificador avisa cuando esto pasa.
 */
export function plantillaParaDias(diasDisponibles: readonly number[]): {
  plantilla: readonly TrainingType[];
  respetaDiasElegidos: boolean;
} {
  const dias = normalizarDiasDisponibles(diasDisponibles);
  const sesiones = sesionesDePlantilla(dias.length);
  const acomodada = acomodarSesionesEnDias(sesiones, dias);

  if (acomodada) return { plantilla: acomodada, respetaDiasElegidos: true };

  return {
    plantilla: MICROCYCLE_TEMPLATES[
      Math.min(MAX_DIAS_ENTRENAMIENTO, Math.max(MIN_DIAS_ENTRENAMIENTO, dias.length))
    ]!,
    respetaDiasElegidos: false,
  };
}
