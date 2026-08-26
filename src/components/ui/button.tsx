import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Botón del design system.
 *
 * Un solo acento de color a la vez: `primary` es el lima, y en una pantalla
 * debería haber como mucho uno. El resto de las acciones van en `ghost` o
 * `outline`, que no compiten con el dato protagonista.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium ' +
    'transition-colors disabled:pointer-events-none disabled:opacity-40 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-foreground hover:bg-accent/90',
        outline: 'border border-border text-fg hover:bg-surface',
        ghost: 'text-fg-muted hover:text-fg hover:bg-surface',
        danger: 'border border-zone-z5c/40 text-zone-z5c hover:bg-zone-z5c/10',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-14 px-6 text-base',
        // Ancho completo: el patrón de la acción principal en mobile.
        block: 'h-14 w-full px-6 text-base',
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
