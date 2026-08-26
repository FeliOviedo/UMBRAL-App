import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/data/database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * true si el proyecto tiene Supabase configurado.
 *
 * Se chequea para poder mostrar una pantalla que explique qué falta, en lugar
 * de reventar con un error críptico de red. Es lo primero que le pasa a
 * cualquiera que clona el repo sin leer el README.
 */
export const supabaseConfigurado = Boolean(url && anonKey);

if (!supabaseConfigurado && import.meta.env.DEV) {
  console.warn(
    'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
      'Copiá .env.example a .env y completalos. Ver README.md.',
  );
}

/**
 * Cliente de Supabase, tipado contra el esquema.
 *
 * La anon key es pública por diseño: el aislamiento entre usuarios lo da Row
 * Level Security, no el secreto de esta clave.
 *
 * Cuando falta configuración se crea igual con valores de relleno, para que la
 * app arranque y pueda mostrar el cartel explicativo. Cualquier consulta va a
 * fallar, y está bien: no hay a dónde consultar.
 */
export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'sin-configurar',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
