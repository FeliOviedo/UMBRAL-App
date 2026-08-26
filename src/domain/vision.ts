/**
 * Lectura de la captura de pantalla del reloj.
 *
 * Es la vía de ÚLTIMO recurso para datos que ningún archivo trae: FC máxima,
 * zancada, training effect. Nunca la vía principal — para distancia, tiempo y
 * pace están el TCX y la carga manual, que son exactos.
 *
 * Tres reglas que no se negocian:
 *
 * 1. **Lo detectado nunca se guarda solo.** Sale a campos editables y la
 *    persona confirma. Un OCR que confunde un 8 con un 3 y guarda en silencio
 *    contamina el historial de forma indetectable.
 * 2. **Cada campo viene con su confianza.** Un número leído con dudas se marca
 *    distinto de uno leído con claridad.
 * 3. **La app funciona sin esto.** Si no hay proveedor configurado, la pantalla
 *    lo dice y ofrece cargar a mano. No es un error, es el estado por defecto.
 *
 * Este archivo define la interfaz y una implementación falsa. El proveedor real
 * se enchufa en la Fase 5 o cuando haya una API configurada.
 */

/** Un dato leído de la imagen, con lo que se sabe sobre cuánto confiar en él. */
export interface CampoDetectado<T> {
  valor: T;
  /**
   * Confianza 0-1 informada por el proveedor.
   *
   * Por debajo de `CONFIANZA_MINIMA` el campo se muestra igual, pero marcado
   * como dudoso: esconderlo obligaría a la persona a transcribirlo a mano
   * cuando quizás está bien.
   */
  confianza: number;
}

/**
 * Lo que se puede extraer de una captura.
 *
 * Deliberadamente acotado a lo que los archivos NO traen. Distancia, tiempo y
 * pace no están acá a propósito: si se pudieran leer de la imagen, alguien los
 * usaría en lugar del archivo, que es exacto.
 */
export interface DatosDeImagen {
  fcMaxima?: CampoDetectado<number>;
  /** Longitud de zancada en centímetros. */
  zancadaCm?: CampoDetectado<number>;
  /** Training effect, en la escala 0-5 que usan la mayoría de los relojes. */
  trainingEffect?: CampoDetectado<number>;
  /** Cadencia media, si el archivo no la trajo. */
  cadenciaSpm?: CampoDetectado<number>;
}

export interface ResultadoVision {
  datos: DatosDeImagen;
  /** Avisos para mostrar junto a los campos. */
  avisos: string[];
}

/**
 * Proveedor de visión. Implementalo para enchufar un modelo real.
 *
 * @param imagen La captura, tal como la eligió la persona.
 */
export interface ProveedorVision {
  readonly nombre: string;
  /** false cuando falta configuración; la UI lo consulta antes de ofrecer el botón. */
  readonly disponible: boolean;
  analizar(imagen: Blob): Promise<ResultadoVision>;
}

/** Por debajo de esto, el campo se marca como dudoso en la UI. */
export const CONFIANZA_MINIMA = 0.7;

/**
 * Proveedor por defecto: no hay ninguno configurado.
 *
 * Falla con un mensaje claro en lugar de devolver datos vacíos, para que sea
 * imposible confundir "no configurado" con "no encontró nada en la imagen".
 */
export const proveedorNoConfigurado: ProveedorVision = {
  nombre: 'sin configurar',
  disponible: false,
  async analizar() {
    throw new Error(
      'No hay un modelo de visión configurado. Podés cargar los datos a mano: la imagen ' +
        'queda guardada igual junto a la sesión.',
    );
  },
};

/**
 * Proveedor de mentira, para desarrollo y tests.
 *
 * Devuelve valores fijos y plausibles. No mira la imagen — es un doble de
 * prueba, no una implementación degradada.
 */
export function crearProveedorFalso(datos: DatosDeImagen = DATOS_FALSOS): ProveedorVision {
  return {
    nombre: 'simulado',
    disponible: true,
    async analizar() {
      return {
        datos,
        avisos: [
          'Estos datos vienen de un proveedor simulado, no de la imagen. Revisalos antes de guardar.',
        ],
      };
    },
  };
}

const DATOS_FALSOS: DatosDeImagen = {
  fcMaxima: { valor: 178, confianza: 0.92 },
  zancadaCm: { valor: 108, confianza: 0.81 },
  trainingEffect: { valor: 3.4, confianza: 0.64 },
};

/**
 * El proveedor activo.
 *
 * Se resuelve una vez, al importar. Cuando exista una implementación real, acá
 * se elige según la configuración del entorno y nada más cambia.
 */
export function obtenerProveedorVision(): ProveedorVision {
  return proveedorNoConfigurado;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación de lo detectado
// ─────────────────────────────────────────────────────────────────────────────

/** Rangos plausibles. Fuera de esto, el dato está mal leído. */
const RANGOS = {
  fcMaxima: [80, 240],
  zancadaCm: [50, 200],
  trainingEffect: [0, 5],
  cadenciaSpm: [100, 240],
} as const satisfies Record<keyof DatosDeImagen, readonly [number, number]>;

export interface CampoRevisable {
  campo: keyof DatosDeImagen;
  etiqueta: string;
  valor: number;
  confianza: number;
  /** true si el valor cae fuera del rango plausible o la confianza es baja. */
  dudoso: boolean;
  sufijo: string;
}

const ETIQUETAS: Record<keyof DatosDeImagen, { etiqueta: string; sufijo: string }> = {
  fcMaxima: { etiqueta: 'FC máxima', sufijo: 'ppm' },
  zancadaCm: { etiqueta: 'Zancada', sufijo: 'cm' },
  trainingEffect: { etiqueta: 'Training effect', sufijo: '' },
  cadenciaSpm: { etiqueta: 'Cadencia', sufijo: 'spm' },
};

/**
 * Convierte lo detectado en una lista lista para mostrar en campos editables.
 *
 * Los valores fuera de rango NO se descartan: se marcan como dudosos y se
 * muestran igual. Si el modelo leyó 1780 donde decía 178, la persona lo ve y lo
 * corrige — descartarlo en silencio le haría creer que la imagen no tenía el dato.
 */
export function aCamposRevisables(datos: DatosDeImagen): CampoRevisable[] {
  const campos: CampoRevisable[] = [];

  for (const clave of Object.keys(ETIQUETAS) as (keyof DatosDeImagen)[]) {
    const detectado = datos[clave];
    if (!detectado) continue;

    const [min, max] = RANGOS[clave];
    const fueraDeRango = detectado.valor < min || detectado.valor > max;

    campos.push({
      campo: clave,
      etiqueta: ETIQUETAS[clave].etiqueta,
      sufijo: ETIQUETAS[clave].sufijo,
      valor: detectado.valor,
      confianza: detectado.confianza,
      dudoso: fueraDeRango || detectado.confianza < CONFIANZA_MINIMA,
    });
  }

  return campos;
}
