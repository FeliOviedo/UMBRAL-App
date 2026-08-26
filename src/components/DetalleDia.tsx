import { Gauge, SkipForward } from 'lucide-react';
import type { DiaPlanificado, Sesion } from '@/data';
import { TRAINING_TYPE_TARGETS, zonaPorId } from '@/domain';
import { Button } from '@/components/ui/button';
import { formatearFechaLarga, formatearKm } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Resumen de un día del plan: qué toca, cuánto, y qué hacer con eso.
 *
 * Un solo componente para el calendario y para la semana — las dos pantallas
 * necesitan exactamente lo mismo (badge de tipo, título de zona, km/RPE,
 * acción principal y "saltear") y tenerlo en dos lugares los desincroniza la
 * primera vez que uno de los dos se toca.
 *
 * Es panel, no fila: a diferencia de `u-row`, esto es una superficie con
 * fondo (`u-panel`) porque funciona como una tarjeta de acción que se abre al
 * elegir un día — no como parte del flujo continuo de la lista.
 */
export default function DetalleDia({
  dia,
  sesion,
  onVer,
  onOmitir,
  className,
}: {
  dia: DiaPlanificado;
  sesion?: Sesion;
  /** Ir al detalle de la sesión registrada, o al registro si todavía no existe. */
  onVer: () => void;
  onOmitir?: () => void;
  className?: string;
}) {
  const objetivo = TRAINING_TYPE_TARGETS[dia.tipo];
  const zona = dia.zonaObjetivo ? zonaPorId(dia.zonaObjetivo) : null;

  if (dia.tipo === 'D') {
    return (
      <div className={cn('u-panel', className)}>
        <p className="u-label">{formatearFechaLarga(dia.fecha)}</p>
        <p className="u-title-sm mt-3">Descanso</p>
        <p className="u-sub mt-2">Ningún entrenamiento programado. Es parte del plan, no un hueco.</p>
      </div>
    );
  }

  return (
    <div className={cn('u-panel', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="u-label">{formatearFechaLarga(dia.fecha)}</p>
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center font-mono text-[11px] font-bold',
            dia.tipo === 'E' ? 'bg-accent text-accent-foreground shadow-glow-soft' : 'bg-zone-z2/20 text-zone-z2',
          )}
        >
          {dia.tipo}
        </span>
      </div>

      <h3 className="u-title-sm mt-3">{zona ? zona.name : objetivo.label}</h3>

      <div className="mt-4 flex items-baseline gap-6">
        <div>
          <p className="u-hero-sm leading-none">
            {formatearKm(sesion?.distanciaMetros != null ? sesion.distanciaMetros / 1000 : dia.km)}
            <span className="u-unit ml-1">km</span>
          </p>
        </div>
        {(dia.zonaObjetivo || dia.rpeObjetivo) && (
          <div className="flex items-center gap-1.5">
            <Gauge size={16} strokeWidth={2} className="text-outline" aria-hidden />
            <span className="font-mono text-data-sm text-fg-muted">
              {dia.zonaObjetivo && `Zona ${dia.zonaObjetivo}`}
              {dia.zonaObjetivo && dia.rpeObjetivo && ' · '}
              {dia.rpeObjetivo && `RPE ${dia.rpeObjetivo}`}
            </span>
          </div>
        )}
      </div>

      {sesion && <p className="u-label mt-4 text-accent">Registrada</p>}

      <div className="mt-6 flex flex-col gap-3">
        <Button size="block" onClick={onVer}>
          {sesion ? 'Ver sesión' : 'Registrar esta sesión'}
        </Button>
        {onOmitir && !sesion && (
          <button
            type="button"
            onClick={onOmitir}
            className="flex items-center justify-center gap-2 py-2 font-mono text-label uppercase text-outline transition-colors hover:text-fg"
          >
            <SkipForward size={14} strokeWidth={2} aria-hidden />
            Saltear esta sesión
          </button>
        )}
      </div>
    </div>
  );
}
