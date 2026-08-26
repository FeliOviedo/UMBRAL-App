import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `twMerge` configurado con la escala tipográfica custom del design system.
 *
 * Por defecto, tailwind-merge sólo reconoce los tamaños de fuente de Tailwind
 * (`text-xs`…`text-9xl`). Como `text-hero`, `text-title`, `text-wordmark`,
 * `text-label`, `text-data` y `text-body` no están en esa lista, caían en el
 * grupo de TEXT COLOR (que acepta cualquier valor) — así que `cn('text-hero',
 * 'text-accent')` los trataba como si compitieran por la misma propiedad y
 * silenciosamente descartaba uno de los dos. Esto rompía cualquier botón o
 * texto que combinara un tamaño custom con un color por `cn()` (el "ENTRAR"
 * del login perdía su color y quedaba blanco en vez del texto oscuro sobre
 * lima, por ejemplo). Registrar la escala acá se lo explica a tailwind-merge
 * de una vez, en el único lugar donde vive `cn`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'hero-sm',
            'hero',
            'hero-lg',
            'hero-xl',
            'title',
            'title-sm',
            'wordmark',
            'label',
            'data',
            'data-sm',
            'body',
            'body-lg',
          ],
        },
      ],
    },
  },
});

/** Combina clases de Tailwind resolviendo conflictos. Requisito de shadcn/ui. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
