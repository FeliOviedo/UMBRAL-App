/**
 * Estado de sesión: quién está logueado y qué datos suyos ya cargamos.
 *
 * Es la única fuente de verdad sobre el usuario actual. Las pantallas leen de
 * acá en lugar de consultar Supabase por su cuenta, así el perfil, el umbral y
 * el plan se cargan una vez y no en cada navegación.
 */

import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import {
  alCambiarSesion,
  cerrarSesion as cerrarSesionRemota,
  obtenerObjetivoActivo,
  obtenerPerfil,
  obtenerPlanActivo,
  obtenerUmbralVigente,
  type Objetivo,
  type Perfil,
  type Plan,
  type Umbral,
} from '@/data';

interface SessionState {
  /** null = no logueado. undefined = todavía no sabemos (arranque). */
  usuario: User | null | undefined;
  perfil: Perfil | null;
  umbral: Umbral | null;
  objetivo: Objetivo | null;
  plan: Plan | null;
  cargandoDatos: boolean;
  error: string | null;

  /** Arranca la escucha de cambios de sesión. Devuelve el limpiador. */
  inicializar: () => () => void;
  /** Vuelve a traer perfil, umbral, objetivo y plan del usuario actual. */
  recargarDatos: () => Promise<void>;
  cerrarSesion: () => Promise<void>;

  setPerfil: (perfil: Perfil) => void;
  setUmbral: (umbral: Umbral) => void;
  setObjetivo: (objetivo: Objetivo | null) => void;
  setPlan: (plan: Plan | null) => void;
}

export const useSession = create<SessionState>((set, get) => ({
  usuario: undefined,
  perfil: null,
  umbral: null,
  objetivo: null,
  plan: null,
  cargandoDatos: false,
  error: null,

  inicializar: () => {
    // onAuthStateChange dispara al suscribirse con la sesión que haya en
    // localStorage, así que no hace falta un getSession() aparte.
    return alCambiarSesion((session) => {
      const anterior = get().usuario;
      const nuevo = session?.user ?? null;

      if (anterior?.id === nuevo?.id && anterior !== undefined) return;

      set({ usuario: nuevo });
      if (nuevo) {
        void get().recargarDatos();
      } else {
        set({ perfil: null, umbral: null, objetivo: null, plan: null, error: null });
      }
    });
  },

  recargarDatos: async () => {
    const usuario = get().usuario;
    if (!usuario) return;

    set({ cargandoDatos: true, error: null });
    try {
      // En paralelo: son cuatro consultas independientes y esperar en serie
      // agregaría tres viajes de red al arranque.
      const [perfil, umbral, objetivo, plan] = await Promise.all([
        obtenerPerfil(usuario.id),
        obtenerUmbralVigente(usuario.id),
        obtenerObjetivoActivo(usuario.id),
        obtenerPlanActivo(usuario.id),
      ]);
      set({ perfil, umbral, objetivo, plan, cargandoDatos: false });
    } catch (error) {
      set({
        cargandoDatos: false,
        error: error instanceof Error ? error.message : 'No se pudieron cargar tus datos.',
      });
    }
  },

  cerrarSesion: async () => {
    await cerrarSesionRemota();
    set({ usuario: null, perfil: null, umbral: null, objetivo: null, plan: null });
  },

  setPerfil: (perfil) => set({ perfil }),
  setUmbral: (umbral) => set({ umbral }),
  setObjetivo: (objetivo) => set({ objetivo }),
  setPlan: (plan) => set({ plan }),
}));
