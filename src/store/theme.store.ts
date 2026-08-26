/**
 * Tema visual: oscuro (por defecto) o claro.
 *
 * El tema se escribe como `data-theme` en el <html>, no como clase, para no
 * chocar con `darkMode: 'class'` de Tailwind ni con utilidades `dark:` que
 * puedan aparecer más adelante. Los tokens de color de `index.css` cuelgan de
 * ese atributo.
 *
 * La preferencia se guarda en localStorage. La primera visita usa el tema del
 * sistema si el navegador lo declara, y oscuro si no dice nada: el diseño de
 * referencia está calibrado en oscuro y es el que define la identidad.
 */

import { create } from 'zustand';

export type Tema = 'dark' | 'light';

const CLAVE = 'umbral:tema';

/** Lee la preferencia guardada, o la del sistema, o el default oscuro. */
export function temaInicial(): Tema {
  if (typeof window === 'undefined') return 'dark';

  try {
    const guardado = window.localStorage.getItem(CLAVE);
    if (guardado === 'dark' || guardado === 'light') return guardado;
  } catch {
    // Modo incógnito o storage bloqueado: se sigue con el tema del sistema.
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Aplica el tema al documento. Es lo único que toca el DOM. */
export function aplicarTema(tema: Tema): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = tema;
}

interface ThemeState {
  tema: Tema;
  setTema: (tema: Tema) => void;
  alternarTema: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  tema: temaInicial(),

  setTema: (tema) => {
    aplicarTema(tema);
    try {
      window.localStorage.setItem(CLAVE, tema);
    } catch {
      // Si no se puede guardar, el tema igual queda aplicado en esta visita.
    }
    set({ tema });
  },

  alternarTema: () => get().setTema(get().tema === 'dark' ? 'light' : 'dark'),
}));
