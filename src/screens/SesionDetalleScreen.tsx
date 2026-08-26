import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { borrarSesion, obtenerSesion, type SesionCompleta } from '@/data';
import { distribucionPorZona, generarZonasPace, zonaPorId } from '@/domain';
import { useSession } from '@/store/session.store';
import RouteMap from '@/components/RouteMap';
import { Button } from '@/components/ui/button';
import { Cargando, ErrorMensaje } from '@/components/ui/feedback';
import { formatearFechaLarga, formatearKm, formatearPaceCorto, formatearTiempo } from '@/lib/format';

/**
 * Detalle de una sesión: mapa, splits, cadencia y distribución por zona.
 *
 * La distribución por zona es un dato de APOYO calculado sobre el pace de los
 * splits — no reemplaza el RPE que cargó la persona, que sigue siendo el que
 * manda y se muestra primero.
 */
export default function SesionDetalleScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const umbral = useSession((s) => s.umbral);

  const [sesion, setSesion] = useState<SesionCompleta | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => {
    if (!id) return;
    setSesion(undefined);
    obtenerSesion(id)
      .then(setSesion)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la sesión.'));
  }, [id]);

  if (error) {
    return (
      <main className="u-page py-section">
        <ErrorMensaje mensaje={error} />
      </main>
    );
  }

  if (sesion === undefined) return <Cargando mensaje="Cargando sesión…" />;

  if (sesion === null) {
    return (
      <main className="u-page py-section">
        <p className="u-sub">No se encontró esa sesión.</p>
        <Button asChild variant="outline" size="block" className="mt-6">
          <Link to="/plan">Volver al plan</Link>
        </Button>
      </main>
    );
  }

  const zonasPace = umbral?.pacePorKm != null ? generarZonasPace(umbral.pacePorKm) : null;
  const distribucion = zonasPace ? distribucionPorZona(sesion.splits, zonasPace) : [];

  async function onBorrar() {
    if (!sesion || !confirm('¿Borrar esta sesión? No se puede deshacer.')) return;
    setBorrando(true);
    try {
      await borrarSesion(sesion.id);
      navigate('/plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar la sesión.');
      setBorrando(false);
    }
  }

  return (
    <main className="u-page pb-16">
      <header className="u-section">
        <p className="u-label">{formatearFechaLarga(sesion.ocurrioEn.slice(0, 10))}</p>
        <h1 className="mt-6 u-hero">
          {sesion.distanciaMetros != null ? formatearKm(sesion.distanciaMetros / 1000) : '—'}
          <span className="ml-2 u-unit">km</span>
        </h1>
        <p className="u-sub mt-2">
          {sesion.duracionSeg != null && formatearTiempo(sesion.duracionSeg)}
          {sesion.paceSegPorKm != null && ` · ${formatearPaceCorto(sesion.paceSegPorKm)}/km`}
        </p>
      </header>

      {sesion.avisosImportacion.length > 0 && (
        <section className="u-section space-y-3">
          {sesion.avisosImportacion.map((aviso) => (
            <p key={aviso} className="text-sm text-zone-z4">
              {aviso}
            </p>
          ))}
        </section>
      )}

      {sesion.track.length > 0 && (
        <section className="u-section">
          <RouteMap track={sesion.track} />
        </section>
      )}

      <section className="u-section">
        <h2 className="u-label">Cómo se sintió</h2>
        <div className="mt-6 flex items-baseline gap-8">
          <div>
            <p className="font-hero text-hero-sm text-accent">{sesion.rpe}</p>
            <p className="u-label mt-2">RPE</p>
          </div>
          {sesion.sensacion != null && (
            <div>
              <p className="font-hero text-hero-sm">{sesion.sensacion}</p>
              <p className="u-label mt-2">Sensación</p>
            </div>
          )}
        </div>
        {sesion.notas && <p className="u-sub mt-4">{sesion.notas}</p>}
      </section>

      {(sesion.fcPromedio != null || sesion.cadenciaSpm != null) && (
        <section className="u-section">
          <h2 className="u-label">Datos objetivos</h2>
          <dl className="mt-6 space-y-3">
            {sesion.fcPromedio != null && (
              <Dato termino="FC promedio" valor={`${sesion.fcPromedio} ppm`} />
            )}
            {sesion.fcMaxima != null && <Dato termino="FC máxima" valor={`${sesion.fcMaxima} ppm`} />}
            {sesion.cadenciaSpm != null && (
              <Dato termino="Cadencia" valor={`${sesion.cadenciaSpm} spm`} />
            )}
            {sesion.calorias != null && <Dato termino="Calorías" valor={`${sesion.calorias} kcal`} />}
          </dl>
        </section>
      )}

      {distribucion.length > 0 && (
        <section className="u-section">
          <h2 className="u-label">Distribución por zona</h2>
          <p className="u-sub mt-1">Según el pace de cada km. El RPE de arriba es el que manda.</p>
          <ul className="mt-6 space-y-3">
            {distribucion.map(({ zona, segundos, fraccion }) => (
              <li key={zona} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: zonaPorId(zona).color }}
                />
                <span className="u-data-sm w-12 shrink-0">{zona}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-surface">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(fraccion * 100)}%`,
                      backgroundColor: zonaPorId(zona).color,
                    }}
                  />
                </div>
                <span className="u-data-sm w-14 shrink-0 text-right text-fg-muted">
                  {formatearTiempo(segundos)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sesion.splits.length > 0 && (
        <section className="u-section">
          <h2 className="u-label">Splits</h2>
          <table className="u-data-sm mt-6 w-full">
            <thead>
              <tr className="u-label text-left">
                <th className="pb-2 font-normal">Km</th>
                <th className="pb-2 font-normal">Tiempo</th>
                <th className="pb-2 text-right font-normal">Pace</th>
              </tr>
            </thead>
            <tbody>
              {sesion.splits.map((split) => (
                <tr key={split.km} className="border-t border-border">
                  <td className="py-2">{split.km}</td>
                  <td className="py-2">{formatearTiempo(split.seconds)}</td>
                  <td className="py-2 text-right">{formatearPaceCorto(split.paceSecPerKm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="u-section">
        <Button variant="danger" size="block" onClick={() => void onBorrar()} disabled={borrando}>
          {borrando ? 'Borrando…' : 'Borrar sesión'}
        </Button>
      </section>
    </main>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="u-sub">{termino}</dt>
      <dd className="u-data-sm text-fg">{valor}</dd>
    </div>
  );
}
