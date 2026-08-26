import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { listarSesiones, type DiaPlanificado, type Plan, type Sesion } from '@/data';
import { TRAINING_TYPE_TARGETS } from '@/domain';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Vacio } from '@/components/ui/feedback';
import { formatearFechaCorta, formatearKm, hoyIso, sumarDias } from '@/lib/format';

/**
 * Dashboard: la sesión de hoy, cuánto llevás de la semana, y qué sigue.
 *
 * Sigue la composición de `design-reference/dashboard_minimalista`: bloques
 * centrados sin ninguna caja, separados por 48px de aire, con el anillo como
 * único elemento gráfico. El anillo es SVG a mano —trazo de 4 sobre un viewBox
 * de 100, igual que el original— y no Recharts: para un solo valor no vale la
 * pena cargar la librería de gráficos, que se reserva para la Caja Negra.
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
      <main className="mx-auto w-full max-w-md px-edge pb-16">
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
    (sesionesSemana?.reduce((sum, s) => sum + (s.distanciaMetros ?? 0), 0) ?? 0) / 1000;
  const progreso =
    semanaActual.totalKm > 0 ? Math.min(1, kmRealesSemana / semanaActual.totalKm) : 0;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-block px-edge pb-16 pt-8">
      {/* Objetivo de hoy: el título va en Archivo Black y en lima. */}
      <section className="flex flex-col items-center text-center">
        <span className="u-label">Objetivo de hoy</span>
        {diaDeHoy && diaDeHoy.tipo !== 'D' ? (
          <>
            <h1 className="mt-unit font-title text-title uppercase text-accent">
              {formatearKm(diaDeHoy.km)} km {TRAINING_TYPE_TARGETS[diaDeHoy.tipo].label}
              {diaDeHoy.zonaObjetivo && ` (${diaDeHoy.zonaObjetivo})`}
            </h1>
            <p className="u-sub mt-unit">
              {diaDeHoy.notas ??
                (diaDeHoy.rpeObjetivo ? `Mantener un esfuerzo de RPE ${diaDeHoy.rpeObjetivo}.` : '')}
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-unit font-title text-title uppercase text-fg">Descanso</h1>
            <p className="u-sub mt-unit">Hoy no se corre. La adaptación pasa descansando.</p>
          </>
        )}
      </section>

      {/* Anillo de progreso semanal. */}
      <section className="flex flex-col items-center">
        <div className="relative flex h-64 w-64 items-center justify-center">
          <AnilloProgreso progreso={progreso} />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="u-hero-lg leading-none">{Math.round(kmRealesSemana)}</span>
            <span className="u-label mt-2 tracking-widest">
              km / {formatearKm(semanaActual.totalKm)}km
            </span>
          </div>
        </div>
        <div className="mt-4 text-center">
          <span className="u-data block">{Math.round(progreso * 100)}%</span>
          <span className="u-label block">Completo</span>
        </div>
      </section>

      {proximoReto && (
        <section>
          <span className="u-label mb-1 block">Próximo reto</span>
          <button
            type="button"
            onClick={() => navigate(`/plan/semana/${semanaActual.numero}`)}
            className="group flex w-full items-center gap-2 text-left"
          >
            <h2 className="u-data transition-colors group-hover:text-accent">
              {TRAINING_TYPE_TARGETS[proximoReto.tipo].label} {formatearKm(proximoReto.km)}km
            </h2>
            <ArrowRight
              size={18}
              strokeWidth={2}
              className="text-outline transition-colors group-hover:text-accent"
              aria-hidden
            />
          </button>
          <p className="u-sub mt-1">{formatearFechaCorta(proximoReto.fecha)}</p>
        </section>
      )}

      {/* Carga semanal: una barra por día, con la de hoy resaltada. */}
      <section>
        <span className="u-label mb-4 block">Carga semanal</span>
        <div className="flex h-24 w-full items-end justify-between gap-2">
          {semanaActual.dias.map((dia) => {
            const maxKm = Math.max(...semanaActual.dias.map((d) => d.km), 1);
            const esHoy = dia.fecha === hoy;
            return (
              <div
                key={dia.id}
                className={
                  esHoy ? 'w-full bg-accent shadow-glow' : 'w-full bg-accent opacity-40'
                }
                style={{ height: `${Math.max(2, (dia.km / maxKm) * 100)}%` }}
                title={`${formatearKm(dia.km)} km`}
              />
            );
          })}
        </div>
      </section>

      <section>
        <Button
          size="block"
          onClick={() =>
            navigate(
              diaDeHoy && diaDeHoy.tipo !== 'D' ? `/registrar?dia=${diaDeHoy.id}` : '/registrar',
            )
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
  const radio = 45;
  const circunferencia = 2 * Math.PI * radio;

  return (
    <svg
      className="h-full w-full -rotate-90"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Progreso semanal: ${Math.round(progreso * 100)}%`}
    >
      <circle cx={50} cy={50} r={radio} fill="none" stroke="hsl(var(--border))" strokeWidth={4} />
      <circle
        cx={50}
        cy={50}
        r={radio}
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        strokeDashoffset={circunferencia * (1 - progreso)}
      />
    </svg>
  );
}
