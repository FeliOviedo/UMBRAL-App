import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Botón del design system.
 *
 * Medido de `design-reference/registro_actividad_minimalista_claro`: el botón
 * principal es un bloque lima SIN radio, con el texto en Space Grotesk,
 * mayúscula y tracking cerrado. El secundario no es una caja: es texto con una
 * línea inferior. Nada de píldoras ni de esquinas redondeadas.
 *
 * Un solo acento por pantalla: si hay dos `primary` a la vista, uno sobra.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-unit transition-colors ' +
    'disabled:pointer-events-none disabled:opacity-40 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-foreground font-wordmark text-wordmark uppercase ' +
          'tracking-tighter hover:opacity-90',
        outline:
          'border-b border-fg font-mono text-label uppercase tracking-widest text-fg ' +
          'hover:border-accent hover:text-accent',
        ghost: 'font-mono text-label uppercase tracking-widest text-outline hover:text-fg',
        danger:
          'border-b border-zone-z5c font-mono text-label uppercase tracking-widest ' +
          'text-zone-z5c hover:opacity-80',
      },
      // `size` controla sólo el espaciado y el ancho. El tamaño de fuente lo
      // fija el variant: el principal es un bloque de 24px, los secundarios son
      // texto de 11px. Si `size` lo pisara, un "Dejar el plan como está" saldría
      // en 24px y se partiría en dos líneas.
      size: {
        sm: 'px-3 py-2',
        md: 'px-5 py-component',
        lg: 'px-edge py-gutter',
        // Ancho completo: el patrón de la acción principal en mobile.
        block: 'w-full px-edge py-gutter',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';
