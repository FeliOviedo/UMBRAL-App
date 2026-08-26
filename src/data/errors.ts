import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Error de la capa de datos, ya traducido a algo que se le puede mostrar a una
 * persona.
 *
 * Los errores crudos de Postgres ("duplicate key value violates unique
 * constraint goals_one_active_per_user") no son para el usuario. Acá se
 * traducen los que sabemos interpretar y el resto queda con un mensaje genérico
 * pero honesto, guardando el original en `cause` para poder depurar.
 */
export class DataError extends Error {
  constructor(
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

/** Traduce un error de Postgrest a un mensaje en español. */
export function traducirError(error: PostgrestError, contexto: string): DataError {
  // 23505: unique_violation. El índice parcial de objetivo/plan activo cae acá.
  if (error.code === '23505') {
    if (error.message.includes('one_active_per_user')) {
      return new DataError(
        'Ya tenés un objetivo activo. Cerralo o abandonalo antes de crear otro.',
        error,
      );
    }
    return new DataError('Ese registro ya existe.', error);
  }

  // 23514: check_violation. Son los rangos del esquema (RPE 1-10, etc.).
  if (error.code === '23514') {
    return new DataError('Alguno de los valores está fuera del rango permitido.', error);
  }

  // 42501: insufficient_privilege — típicamente RLS rechazando la operación.
  if (error.code === '42501') {
    return new DataError('No tenés permiso para acceder a esos datos.', error);
  }

  // PGRST116: la consulta esperaba una fila y no encontró ninguna.
  if (error.code === 'PGRST116') {
    return new DataError('No se encontró el registro buscado.', error);
  }

  return new DataError(`No se pudo ${contexto}. Probá de nuevo en un momento.`, error);
}

/** Traduce los errores de Auth, que tienen sus propios mensajes en inglés. */
export function traducirErrorAuth(error: { message: string; status?: number }): DataError {
  const msg = error.message.toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return new DataError('Email o contraseña incorrectos.', error);
  }
  if (msg.includes('user already registered')) {
    return new DataError('Ya existe una cuenta con ese email. Probá iniciar sesión.', error);
  }
  if (msg.includes('password should be at least')) {
    return new DataError('La contraseña tiene que tener al menos 6 caracteres.', error);
  }
  if (msg.includes('email not confirmed')) {
    return new DataError(
      'Todavía no confirmaste tu email. Revisá tu casilla, incluida la carpeta de spam.',
      error,
    );
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return new DataError('Ese email no parece válido.', error);
  }
  if (msg.includes('rate limit') || error.status === 429) {
    return new DataError('Demasiados intentos. Esperá un minuto y probá de nuevo.', error);
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return new DataError(
      'No se pudo conectar con el servidor. Revisá tu conexión y la configuración de Supabase.',
      error,
    );
  }

  return new DataError('No se pudo completar la operación. Probá de nuevo.', error);
}
