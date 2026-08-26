import {
  diasSugeridosPara,
  MAX_DIAS_ENTRENAMIENTO,
  MIN_DIAS_ENTRENAMIENTO,
  validarDiasDisponibles,
} from '@/domain';
import { cn } from '@/lib/utils';

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const NOMBRES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

interface Props {
  /** Días seleccionados (0 = lunes). */
  valor: readonly number[];
  onChange: (dias: number[]) => void;
  /** Muestra el mensaje de validación debajo. */
  mostrarValidacion?: boolean;
  className?: string;
}

/**
 * Selector de los días de la semana en los que se puede entrenar.
 *
 * Chips rectangulares sin radio, como el resto de los controles del sistema.
 * El acento lima con halo marca lo elegido: es el único "adorno" del design
 * system y acá hace el trabajo de decir qué días quedaron adentro.
 */
export default function SelectorDias({ valor, onChange, mostrarValidacion = true, className }: Props) {
  const seleccionados = new Set(valor);
  const validacion = validarDiasDisponibles([...valor]);

  const alternar = (dia: number) => {
    const siguiente = new Set(seleccionados);
    if (siguiente.has(dia)) siguiente.delete(dia);
    else siguiente.add(dia);
    onChange([...siguiente].sort((a, b) => a - b));
  };

  const CANTIDADES = [3, 4, 5, 6] as const;

  return (
    <div className={className}>
      {/* Primero CUÁNTOS: es la pregunta que la gente sabe contestar de una.
          Elegir la cantidad propone una distribución, y después se puede mover
          cualquier día en la grilla de abajo. */}
      <div>
        <span className="u-label">Cuántos días por semana</span>
        <div className="mt-3 flex gap-2">
          {CANTIDADES.map((n) => {
            const activo = valor.length === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(diasSugeridosPara(n))}
                aria-pressed={activo}
                className={cn(
                  'flex-1 border py-2.5 font-mono text-data uppercase transition-colors',
                  activo
                    ? 'border-accent bg-accent text-accent-foreground shadow-glow-soft'
                    : 'border-border text-fg-muted hover:border-outline hover:text-fg',
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <p className="u-label mt-6">Y cuáles</p>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {INICIALES.map((inicial, dia) => {
          const activo = seleccionados.has(dia);
          return (
            <button
              key={dia}
              type="button"
              onClick={() => alternar(dia)}
              aria-pressed={activo}
              aria-label={NOMBRES[dia]}
              title={NOMBRES[dia]}
              className={cn(
                'flex aspect-square items-center justify-center border font-mono text-data-sm uppercase transition-colors',
                activo
                  ? 'border-accent bg-accent text-accent-foreground shadow-glow-soft'
                  : 'border-border text-outline hover:border-outline hover:text-fg',
              )}
            >
              {inicial}
            </button>
          );
        })}
      </div>

      <p className="u-label mt-3">
        {valor.length} {valor.length === 1 ? 'día' : 'días'} por semana
      </p>

      {mostrarValidacion && !validacion.valido && (
        <p className="u-sub mt-2 text-zone-z4">{validacion.mensaje}</p>
      )}

      {mostrarValidacion && validacion.valido && (
        <p className="u-sub mt-2">
          Entre {MIN_DIAS_ENTRENAMIENTO} y {MAX_DIAS_ENTRENAMIENTO} días. El plan acomoda las
          sesiones sólo en los días que elijas, sin romper las reglas del microciclo.
        </p>
      )}
    </div>
  );
}
