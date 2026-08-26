import { Link } from 'react-router-dom';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { formatearFechaCorta, formatearKm, formatearPaceCorto } from '@/lib/format';
import { PROGRESSION_TABLE } from '@/domain';

/** Configuración: qué sabe la app de vos, y la salida. */
export default function ConfigScreen() {
  const usuario = useSession((s) => s.usuario);
  const perfil = useSession((s) => s.perfil);
  const umbral = useSession((s) => s.umbral);
  const cerrarSesion = useSession((s) => s.cerrarSesion);

  const ritmo = PROGRESSION_TABLE.find((r) => r.level === perfil?.ritmoBase);

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">Ajustes</p>
        <h1 className="mt-6 font-display text-2xl font-semibold">
          {perfil?.nombre || 'Tu cuenta'}
        </h1>
        <p className="u-sub mt-2">{usuario?.email}</p>
      </header>

      <section className="u-section border-t border-border">
        <h2 className="u-section-title">Tus datos</h2>
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
            <Link to="/onboarding">Editar mi perfil</Link>
          </Button>
          <Button asChild variant="outline" size="block">
            <Link to="/umbral">Volver a testear mi umbral</Link>
          </Button>
        </div>
      </section>

      <section className="u-section border-t border-border">
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
      <dd className="u-table text-fg">{valor}</dd>
    </div>
  );
}
