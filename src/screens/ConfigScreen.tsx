import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '@/store/session.store';
import { actualizarPerfil } from '@/data';
import { Button } from '@/components/ui/button';
import SelectorDias from '@/components/SelectorDias';
import { ErrorMensaje } from '@/components/ui/feedback';
import { formatearFechaCorta, formatearKm, formatearPaceCorto } from '@/lib/format';
import { PROGRESSION_TABLE, validarDiasDisponibles } from '@/domain';

/** Configuración: qué sabe la app de vos, y la salida. */
export default function ConfigScreen() {
  const usuario = useSession((s) => s.usuario);
  const perfil = useSession((s) => s.perfil);
  const umbral = useSession((s) => s.umbral);
  const cerrarSesion = useSession((s) => s.cerrarSesion);
  const setPerfil = useSession((s) => s.setPerfil);

  const [dias, setDias] = useState<number[]>(perfil?.diasEntrenamiento ?? []);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ritmo = PROGRESSION_TABLE.find((r) => r.level === perfil?.ritmoBase);
  const diasValidos = validarDiasDisponibles(dias).valido;
  const diasCambiaron =
    [...dias].sort().join(',') !== [...(perfil?.diasEntrenamiento ?? [])].sort().join(',');

  async function guardarDias() {
    if (!usuario) return;
    setGuardando(true);
    setError(null);
    try {
      setPerfil(await actualizarPerfil(usuario.id, { diasEntrenamiento: dias }));
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la preferencia.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="u-page pb-16">
      <header className="u-section">
        <p className="u-label">Ajustes</p>
        <h1 className="mt-6 u-title">
          {perfil?.nombre || 'Tu cuenta'}
        </h1>
        <p className="u-sub mt-2">{usuario?.email}</p>
      </header>

      <section className="u-section">
        <h2 className="u-label">Días para entrenar</h2>
        <p className="u-sub mt-2">
          Se usan como punto de partida cuando armás un plan nuevo. Podés cambiarlos las veces que
          quieras.
        </p>
        <SelectorDias valor={dias} onChange={setDias} className="mt-6" />
        {error && <ErrorMensaje mensaje={error} className="mt-4" />}
        {diasCambiaron && (
          <Button className="mt-4" onClick={() => void guardarDias()} disabled={!diasValidos || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        )}
        {guardado && !diasCambiaron && <p className="u-sub mt-4 text-accent">Guardado.</p>}
      </section>

      <section className="u-section">
        <h2 className="u-label">Tus datos</h2>
        <dl className="mt-6 space-y-4">
          <Dato
            termino="Volumen semanal"
            valor={
              perfil?.volumenSemanalKm != null
                ? `${formatearKm(perfil.volumenSemanalKm)} km`
                : 'Sin cargar'
            }
          />
          <Dato
            termino="Ritmo base"
            valor={ritmo ? `${ritmo.label} · ${formatearPaceCorto(ritmo.paceSecPerKm)}/km` : 'Sin cargar'}
          />
          <Dato
            termino="Pace de umbral"
            valor={umbral?.pacePorKm != null ? `${formatearPaceCorto(umbral.pacePorKm)}/km` : 'Sin cargar'}
          />
          <Dato termino="LTHR" valor={umbral?.lthr != null ? `${umbral.lthr} ppm` : 'Sin cargar'} />
          <Dato
            termino="Último test"
            valor={umbral ? formatearFechaCorta(umbral.fecha) : 'Sin cargar'}
          />
        </dl>

        <div className="mt-8 space-y-3">
          <Button asChild variant="outline" size="block">
            <Link to="/zonas">Ver mis zonas</Link>
          </Button>
          <Button asChild variant="outline" size="block">
            <Link to="/ajustes">Ajustes del plan</Link>
          </Button>
          <Button asChild variant="outline" size="block">
            <Link to="/onboarding">Editar mi perfil</Link>
          </Button>
          <Button asChild variant="outline" size="block">
            <Link to="/umbral">Volver a testear mi umbral</Link>
          </Button>
        </div>
      </section>

      <section className="u-section">
        <Button variant="ghost" size="block" onClick={() => void cerrarSesion()}>
          Cerrar sesión
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
