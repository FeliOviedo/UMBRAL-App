/**
 * Perfil del corredor.
 *
 * La fila la crea el trigger `handle_new_user` al registrarse, así que acá sólo
 * se lee y se actualiza. Nunca se inserta.
 */

import { supabase } from '@/lib/supabase';
import type { BasePaceLevel } from '@/domain/types';
import type { ProfileRow } from './database.types';
import { traducirError } from './errors';

export interface Perfil {
  id: string;
  nombre: string | null;
  anioNacimiento: number | null;
  pesoKg: number | null;
  ritmoBase: BasePaceLevel | null;
  volumenSemanalKm: number | null;
  onboardingCompleto: boolean;
}

function aDominio(row: ProfileRow): Perfil {
  return {
    id: row.id,
    nombre: row.display_name,
    anioNacimiento: row.birth_year,
    pesoKg: row.weight_kg,
    ritmoBase: row.base_pace_level,
    volumenSemanalKm: row.current_weekly_km,
    onboardingCompleto: row.onboarding_completed,
  };
}

/**
 * Trae el perfil del usuario logueado.
 *
 * Devuelve `null` si no hay fila. Puede pasar si el trigger no estaba instalado
 * cuando se creó la cuenta — el onboarding lo maneja sin romperse.
 */
export async function obtenerPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw traducirError(error, 'cargar tu perfil');
  return data ? aDominio(data) : null;
}

export interface DatosPerfil {
  nombre?: string | null;
  anioNacimiento?: number | null;
  pesoKg?: number | null;
  ritmoBase?: BasePaceLevel | null;
  volumenSemanalKm?: number | null;
  onboardingCompleto?: boolean;
}

export async function actualizarPerfil(userId: string, datos: DatosPerfil): Promise<Perfil> {
  // Se arma sólo con los campos presentes para no pisar con null lo que el
  // llamador no quiso tocar.
  const patch: Partial<ProfileRow> = {};
  if (datos.nombre !== undefined) patch.display_name = datos.nombre;
  if (datos.anioNacimiento !== undefined) patch.birth_year = datos.anioNacimiento;
  if (datos.pesoKg !== undefined) patch.weight_kg = datos.pesoKg;
  if (datos.ritmoBase !== undefined) patch.base_pace_level = datos.ritmoBase;
  if (datos.volumenSemanalKm !== undefined) patch.current_weekly_km = datos.volumenSemanalKm;
  if (datos.onboardingCompleto !== undefined) {
    patch.onboarding_completed = datos.onboardingCompleto;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw traducirError(error, 'guardar tu perfil');
  return aDominio(data);
}
