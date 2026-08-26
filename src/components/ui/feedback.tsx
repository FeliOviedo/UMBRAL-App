import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Estados de carga, error y vacío.
 *
 * Sobrios a propósito: un texto centrado y nada más. No hay spinners animados
 * ni ilustraciones — la app tiene que verse tranquila incluso cuando no tiene
 * nada para mostrar.
 */

export function Cargando({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <p className="u-sub">{mensaje}</p>
    </div>
  );
}

export function ErrorMensaje({
  mensaje,
  onReintentar,
  className,
}: {
  mensaje: string;
  onReintentar?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg bg-surface p-4', className)} role="alert">
      <p className="text-sm text-zone-z5c">{mensaje}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="mt-2 text-sm text-accent underline underline-offset-4"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Aviso no bloqueante: el plan se comprimió, el archivo no traía FC, etc. */
export function Aviso({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-sm leading-relaxed text-zone-z4', className)}>{children}</p>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="py-section text-center">
      <p className="u-title-sm text-fg">{titulo}</p>
      {children && <div className="u-sub mx-auto mt-2 max-w-xs">{children}</div>}
    </div>
  );
}
