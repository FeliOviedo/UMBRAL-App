import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  descartarPropuesta,
  listarPropuestasPendientes,
  marcarComoAplicada,
  obtenerPlanActivo,
  reemplazarDiasDeSemana,
  type AdaptacionGuardada,
} from '@/data';
import { useSession } from '@/store/session.store';
import DiffSemana from '@/components/DiffSemana';
import { Button } from '@/components/ui/button';
import { Cargando, ErrorMensaje, Vacio } from '@/components/ui/feedback';
import { formatearFechaCorta } from '@/lib/format';

/**
 * Re-calibración: los ajustes que el motor propuso, con su antes y después.
 *
 * Nada se aplica solo. Cada propuesta se muestra con la explicación completa —
 * por qué el motor la sugiere — y el diff de la semana, y recién ahí hay un
 * botón para confirmar. Un plan que cambia sin que nadie lo haya visto es
 * indistinguible de un bug.
 */
export default function AjustesPlanScreen() {
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);
  const plan = useSession((s) => s.plan);
  const setPlan = useSession((s) => s.setPlan);

  const [propuestas, setPropuestas] = useState<AdaptacionGuardada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    listarPropuestasPendientes(usuario.id)
      .then(setPropuestas)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los ajustes.'),
      );
  }, [usuario]);

  async function aplicar(propuesta: AdaptacionGuardada) {
    if (!usuario) return;
    setProcesando(propuesta.id);
    setError(null);
    try {
      if (propuesta.snapshotDespues && propuesta.planWeekId) {
        await reemplazarDiasDeSemana(usuario.id, propuesta.planWeekId, propuesta.snapshotDespues);
      }
      await marcarComoAplicada(propuesta.id);
      // El plan cambió: se vuelve a leer entero en lugar de parchearlo en
      // memoria, para que lo que se ve sea lo que quedó guardado.
      setPlan(await obtenerPlanActivo(usuario.id));
      setPropuestas((actuales) => actuales?.filter((p) => p.id !== propuesta.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el ajuste.');
    } finally {
      setProcesando(null);
    }
  }

  /** Para los avisos que no tocan el plan: se archivan, no se borran. */
  async function marcarVisto(propuesta: AdaptacionGuardada) {
    setProcesando(propuesta.id);
    setError(null);
    try {
      await marcarComoAplicada(propuesta.id);
      setPropuestas((actuales) => actuales?.filter((p) => p.id !== propuesta.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo archivar el aviso.');
    } finally {
      setProcesando(null);
    }
  }

  async function descartar(propuesta: AdaptacionGuardada) {
    setProcesando(propuesta.id);
    setError(null);
    try {
      await descartarPropuesta(propuesta.id);
      setPropuestas((actuales) => actuales?.filter((p) => p.id !== propuesta.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descartar el ajuste.');
    } finally {
      setProcesando(null);
    }
  }

  if (propuestas === null && !error) return <Cargando mensaje="Buscando ajustes…" />;

  return (
    <main className="u-page flex flex-col gap-section pb-16 pt-8">
      <header>
        <span className="u-label">Ajustes del plan</span>
        <h1 className="u-title mt-unit">
          {propuestas && propuestas.length > 0
            ? `${propuestas.length} ${propuestas.length === 1 ? 'ajuste propuesto' : 'ajustes propuestos'}`
            : 'Sin ajustes pendientes'}
        </h1>
        <p className="u-sub mt-2">
          Cuando algo no sale como estaba planificado, el motor propone un cambio y te explica por
          qué. Nada se aplica sin que lo confirmes.
        </p>
      </header>

      {error && <ErrorMensaje mensaje={error} />}

      {propuestas && propuestas.length === 0 && (
        <Vacio titulo="Todo en orden">
          <p>
            No hay nada que ajustar. Los ajustes aparecen acá cuando te salteás una sesión, cargás
            una actividad extra o una sesión se siente mucho más dura de lo esperado.
          </p>
          <Button asChild variant="outline" size="block" className="mt-8">
            <Link to="/plan">Ver mi plan</Link>
          </Button>
        </Vacio>
      )}

      {propuestas?.map((propuesta) => {
        const semana = plan?.semanas.find((s) => s.id === propuesta.planWeekId);
        const trabajando = procesando === propuesta.id;

        return (
          <article key={propuesta.id} className="border-b border-border pb-section">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="u-title-sm">{propuesta.titulo}</h2>
              <span className="u-label shrink-0">
                {formatearFechaCorta(propuesta.creadaEn.slice(0, 10))}
              </span>
            </div>

            {semana && (
              <p className="u-label mt-1">
                Microciclo {semana.numero}
              </p>
            )}

            <p className="u-sub mt-3 leading-relaxed">{propuesta.explicacion}</p>

            {propuesta.snapshotAntes && propuesta.snapshotDespues && (
              <div className="mt-6">
                <DiffSemana
                  antes={propuesta.snapshotAntes}
                  despues={propuesta.snapshotDespues}
                  diasModificados={diasModificados(
                    propuesta.snapshotAntes,
                    propuesta.snapshotDespues,
                  )}
                />
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3">
              {propuesta.snapshotDespues && propuesta.planWeekId ? (
                <Button size="block" disabled={trabajando} onClick={() => void aplicar(propuesta)}>
                  {trabajando ? 'Aplicando…' : 'Aplicar el ajuste'}
                </Button>
              ) : (
                // Un aviso informativo no cambia el plan: se marca como visto
                // y queda en el historial, no se borra.
                <Button size="block" disabled={trabajando} onClick={() => void marcarVisto(propuesta)}>
                  Entendido
                </Button>
              )}
              <Button
                variant="ghost"
                size="block"
                disabled={trabajando}
                onClick={() => void descartar(propuesta)}
              >
                Dejar el plan como está
              </Button>
            </div>
          </article>
        );
      })}

      {propuestas && propuestas.length > 0 && (
        <Button variant="outline" size="block" onClick={() => navigate('/plan')}>
          Ver el plan completo
        </Button>
      )}
    </main>
  );
}

/** Días cuyo tipo cambió entre las dos versiones. */
function diasModificados(
  antes: readonly { dayIndex: number; type: string }[],
  despues: readonly { dayIndex: number; type: string }[],
): number[] {
  return despues
    .filter((d) => {
      const original = antes.find((a) => a.dayIndex === d.dayIndex);
      return !original || original.type !== d.type;
    })
    .map((d) => d.dayIndex);
}
