/**
 * Autenticación por email y contraseña.
 *
 * No hay lógica de negocio acá: sólo envolver Supabase Auth y traducir sus
 * errores al español.
 */

import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { traducirErrorAuth } from './errors';

export async function registrarse(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ user: User | null; necesitaConfirmarEmail: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // El trigger handle_new_user lee display_name de acá para crear el perfil.
    options: { data: displayName ? { display_name: displayName } : undefined },
  });
  if (error) throw traducirErrorAuth(error);

  // Con confirmación de email activada, signUp devuelve usuario pero sin sesión.
  return { user: data.user, necesitaConfirmarEmail: data.session === null };
}

export async function iniciarSesion(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw traducirErrorAuth(error);
  if (!data.user) throw traducirErrorAuth({ message: 'sin usuario' });
  return data.user;
}

export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw traducirErrorAuth(error);
}

export async function sesionActual(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Se suscribe a los cambios de sesión (login, logout, refresh del token).
 *
 * @returns función para desuscribirse.
 */
export function alCambiarSesion(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function enviarResetDePassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw traducirErrorAuth(error);
}
