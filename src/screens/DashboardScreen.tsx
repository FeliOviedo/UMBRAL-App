import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listarSesiones, type DiaPlanificado, type Plan, type Sesion } from '@/data';
import { TRAINING_TYPE_TARGETS } from '@/domain';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Vacio } from '@/components/ui/feedback';
import { formatearFechaCorta, formatearKm, hoyIso, sumarDias } from '@/lib/format';

/**
 * Dashboard: la sesión de hoy, cuánto llevás de la semana, y qué sigue.
 *
 * El anillo de progreso es SVG a mano, no Recharts: para un solo valor no vale
 * la pena cargar la librería de gráficos completa. Recharts se reserva para la
 * Caja Negra (Fase 5), que sí necesita series y dispersión.
 */
export default function DashboardScreen() {
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);
  const perfil = useSession((s) => s.perfil);
  const plan = useSession((s) => s.plan);

  const [sesionesSemana, setSesionesSemana] = useState<Sesion[] | null>(null);

  const hoy = hoyIso();
  const semanaActual = plan?.semanas.find(
    (s) => hoy >= s.fechaInicio && hoy < sumarDias(s.fechaInicio, 7),
  );

  useEffect(() => {
    if (!usuario || !semanaActual) return;
    listarSesiones(usuario.id, {
      desde: semanaActual.fechaInicio,
      hasta: sumarDias(semanaActual.fechaInicio, 6),
    })
      .then(setSesionesSemana)
      .catch(() => setSesionesSemana([]));
  }, [usuario, semanaActual]);

  if (!plan || !semanaActual) {
    return (
      <main className="mx-auto w-full max-w-md px-6 pb-16">
        <Vacio titulo={`Hola${perfil?.nombre ? `, ${perfil.nombre}` : ''}`}>
          <p>Todavía no tenés un plan activo.</p>
          <Button asChild size="block" className="mt-8">
            <Link to="/objetivo">Definir mi objetivo</Link>
          </Button>
        </Vacio>
      </main>
    );
  }

  const diaDeHoy = semanaActual.dias.find((d) => d.fecha === hoy);
  const proximoReto = semanaActual.dias
    .concat(siguienteSemana(plan, semanaActual.numero))
    .find((d) => d.fecha > hoy && d.km > 0);

  const kmRealesSemana =
    sesionesSemana?.reduce((sum, s) => sum + (s.distanciaMetros ?? 0), 0) ?? 0;
  const progreso =
    semanaActual.totalKm > 0 ? Math.min(1, kmRealesSemana / 1000 / semanaActual.totalKm) : 0;

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">
          Objetivo de hoy
        </p>
        {diaDeHoy && diaDeHoy.tipo !== 'D' ? (
          <>
            <h1 className="mt-3 font-display text-2xl font-semibold leading-tight text-fg">
              {formatearKm(diaDeHoy.km)} km · {TRAINING_TYPE_TARGETS[diaDeHoy.tipo].label}
              {diaDeHoy.zonaObjetivo && ` (${diaDeHoy.zonaObjetivo})`}
            </h1>
            {diaDeHoy.notas && <p className="u-sub mt-2">{diaDeHoy.notas}</p>}
          </>
        ) : (
          <h1 className="mt-3 font-display text-2xl font-semibold text-fg">Descanso</h1>
        )}
      </header>

      <section className="u-section flex flex-col items-center border-t border-border">
        <AnilloProgreso progreso={progreso} />
        <p className="mt-6 u-sub">
          {formatearKm(kmRealesSemana / 1000)} / {formatearKm(semanaActual.totalKm)} km esta
          semana
        </p>
      </section>

      {proximoReto && (
        <section className="u-section border-t border-border">
          <p className="u-label">Próximo reto</p>
          <button
            type="button"
            onClick={() => navigate(`/plan/semana/${semanaActual.numero}`)}
            className="mt-3 flex w-full items-baseline justify-between text-left"
          >
            <span className="font-display text-lg font-semibold">
              {TRAINING_TYPE_TARGETS[proximoReto.tipo].label} {formatearKm(proximoReto.km)}km
            </span>
            <span className="u-sub">{formatearFechaCorta(proximoReto.fecha)}</span>
          </button>
        </section>
      )}

      <section className="u-section border-t border-border">
        <Button
          size="block"
          onClick={() =>
            navigate(diaDeHoy && diaDeHoy.tipo !== 'D' ? `/registrar?dia=${diaDeHoy.id}` : '/registrar')
          }
        >
          Registrar sesión
        </Button>
      </section>
    </main>
  );
}

/** Días de la semana siguiente, para que "próximo reto" no se corte el domingo. */
function siguienteSemana(plan: Plan, numeroActual: number): DiaPlanificado[] {
  return plan.semanas.find((s) => s.numero === numeroActual + 1)?.dias ?? [];
}

function AnilloProgreso({ progreso }: { progreso: number }) {
  const radio = 80;
  const circunferencia = 2 * Math.PI * radio;
  const offset = circunferencia * (1 - progreso);

  return (
    <svg width={200} height={200} viewBox="0 0 200 200" role="img" aria-label="Progreso semanal">
      <circle cx={100} cy={100} r={radio} fill="none" stroke="hsl(var(--border))" strokeWidth={14} />
      <circle
        cx={100}
        cy={100}
        r={radio}
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        strokeDashoffset={offset}
        transform="rotate(-90 100 100)"
      />
      <text
        x={100}
        y={106}
        textAnchor="middle"
        className="fill-fg font-hero"
        style={{ fontSize: '2.5rem' }}
      >
        {Math.round(progreso * 100)}%
      </text>
    </svg>
  );
}
