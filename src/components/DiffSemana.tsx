import { TRAINING_TYPE_TARGETS } from '@/domain';
import type { PlannedDay, TrainingType } from '@/domain/types';
import { DIAS_SEMANA, formatearKm } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * El antes y el después de una adaptación, lado a lado.
 *
 * Es la pieza central de la pantalla de re-calibración: nada se aplica sin que
 * la persona vea exactamente qué cambia. Los días modificados se resaltan con
 * el acento; el resto queda en gris para que el diff se lea de un vistazo.
 */

const COLOR_TIPO: Record<TrainingType, string> = {
  F: 'bg-accent text-accent-foreground',
  E: 'bg-accent text-accent-foreground',
  R: 'bg-zone-z2/20 text-zone-z2 border border-zone-z2/50',
  D: 'bg-surface text-outline',
};

export interface DiffSemanaProps {
  antes: readonly PlannedDay[];
  despues: readonly PlannedDay[];
  diasModificados: readonly number[];
}

export default function DiffSemana({ antes, despues, diasModificados }: DiffSemanaProps) {
  const kmAntes = antes.reduce((s, d) => s + d.km, 0);
  const kmDespues = despues.reduce((s, d) => s + d.km, 0);

  return (
    <div className="flex flex-col gap-gutter">
      <Fila titulo="Ahora" dias={antes} resaltar={[]} totalKm={kmAntes} />
      <Fila
        titulo="Quedaría"
        dias={despues}
        resaltar={diasModificados}
        totalKm={kmDespues}
        deltaKm={kmDespues - kmAntes}
      />
    </div>
  );
}

function Fila({
  titulo,
  dias,
  resaltar,
  totalKm,
  deltaKm,
}: {
  titulo: string;
  dias: readonly PlannedDay[];
  resaltar: readonly number[];
  totalKm: number;
  deltaKm?: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="u-label">{titulo}</span>
        <span className="u-data-sm text-outline">
          {formatearKm(totalKm)} km
          {deltaKm !== undefined && deltaKm !== 0 && (
            <span className={deltaKm > 0 ? 'text-accent' : 'text-zone-z4'}>
              {' '}
              ({deltaKm > 0 ? '+' : ''}
              {formatearKm(deltaKm)})
            </span>
          )}
        </span>
      </div>

      <ol className="flex gap-1">
        {dias.map((dia, i) => {
          const modificado = resaltar.includes(dia.dayIndex);
          return (
            <li key={dia.dayIndex} className="flex flex-1 flex-col items-center gap-1">
              <span className="u-label text-[10px]">{DIAS_SEMANA[i]?.slice(0, 1)}</span>
              <span
                className={cn(
                  'flex h-8 w-full items-center justify-center font-mono text-[11px] font-bold',
                  COLOR_TIPO[dia.type],
                  modificado && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
                )}
                title={`${TRAINING_TYPE_TARGETS[dia.type].label}${dia.km > 0 ? ` · ${formatearKm(dia.km)} km` : ''}`}
              >
                {dia.type}
              </span>
              <span className="u-label text-[10px] tabular-nums">
                {dia.km > 0 ? formatearKm(dia.km) : '—'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
