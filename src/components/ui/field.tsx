import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de formulario: label discreta arriba, input sin caja pesada.
 *
 * El input usa sólo una línea inferior en lugar de un borde completo — menos
 * cajas, que es la regla del design system. La línea se pinta con el acento
 * cuando el campo tiene foco, y en rojo de zona cuando hay error.
 */

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Texto de ayuda debajo del campo. */
  hint?: ReactNode;
  error?: string | null;
  /** Sufijo a la derecha del valor: "km", "ppm", "/km". */
  suffix?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, error, suffix, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="w-full">
        <label htmlFor={inputId} className="u-label block">
          {label}
        </label>
        <div className="mt-2 flex items-baseline gap-2 border-b border-border focus-within:border-accent">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'w-full bg-transparent py-2 font-mono text-data tabular-nums text-fg outline-none',
              'placeholder:font-sans placeholder:text-body placeholder:text-outline/60',
              className,
            )}
            {...props}
          />
          {suffix && <span className="u-label shrink-0">{suffix}</span>}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="mt-2 text-sm text-zone-z5c">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="u-sub mt-2">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Field.displayName = 'Field';

/**
 * Selector de una opción entre pocas, como chips.
 *
 * Un solo acento a la vez: la opción elegida se pinta con el lima y el resto
 * queda en gris, sin bordes decorativos.
 */
export interface ChipsProps<T extends string> {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
}

export function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: ChipsProps<T>) {
  return (
    <div className="w-full">
      <p className="u-label">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'border px-4 py-2 font-mono text-data-sm uppercase transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                selected
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-transparent bg-surface text-outline hover:text-fg',
              )}
            >
              {option.label}
              {option.hint && (
                <span className={cn('ml-2 text-xs', selected ? 'opacity-70' : 'opacity-60')}>
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hint && <p className="u-sub mt-3">{hint}</p>}
    </div>
  );
}
