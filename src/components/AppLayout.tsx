import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  LineChart,
  Plus,
  Settings,
  User,
} from 'lucide-react';
import { useSession } from '@/store/session.store';
import ThemeToggle from '@/components/ThemeToggle';
import BotonVolver, { esRutaRaiz } from '@/components/BotonVolver';
import { cn } from '@/lib/utils';

/**
 * Layout de la app, en dos formas según el ancho.
 *
 * En móvil: app bar arriba y navegación inferior de CUATRO destinos como
 * máximo — una barra con más íconos se vuelve imposible de acertar con el
 * pulgar.
 *
 * En desktop (md+): la barra inferior desaparece y la navegación pasa a una
 * sidebar fija de 256px, como en `design-reference/*_desktop`. La sidebar no
 * tiene la restricción de los cuatro destinos: ahí sí entran Calendario y
 * Volumen, que en móvil viven dentro de sus secciones.
 */
const DESTINOS_MOVIL = [
  { to: '/hoy', label: 'Hoy', Icon: LayoutGrid },
  { to: '/plan', label: 'Plan', Icon: CalendarRange },
  { to: '/analisis', label: 'Análisis', Icon: BarChart3 },
  { to: '/config', label: 'Perfil', Icon: User },
] as const;

const DESTINOS_SIDEBAR = [
  { to: '/hoy', label: 'Hoy', Icon: LayoutGrid },
  { to: '/plan', label: 'Plan', Icon: CalendarRange },
  { to: '/calendario', label: 'Calendario', Icon: CalendarDays },
  { to: '/analisis', label: 'Caja Negra', Icon: BarChart3 },
  { to: '/volumen', label: 'Volumen', Icon: LineChart },
  { to: '/config', label: 'Perfil', Icon: User },
] as const;

export default function AppLayout() {
  const perfil = useSession((s) => s.perfil);
  const { pathname } = useLocation();
  const enSubseccion = !esRutaRaiz(pathname);

  return (
    <div className="min-h-dvh bg-bg">
      {/* ── Sidebar (desktop) ───────────────────────────────────────────── */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-bg px-5 py-6 md:flex"
      >
        <Link to="/hoy" className="u-wordmark text-accent">
          Umbral
        </Link>

        {perfil?.nombre && (
          <p className="u-label mt-6 truncate" title={perfil.nombre}>
            {perfil.nombre}
          </p>
        )}

        <ul className="mt-8 flex flex-1 flex-col gap-1">
          {DESTINOS_SIDEBAR.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                    isActive
                      ? 'bg-surface text-accent'
                      : 'text-fg-muted hover:bg-surface hover:text-fg',
                  )
                }
              >
                <Icon size={18} strokeWidth={2} aria-hidden />
                <span className="font-mono text-label uppercase">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <Link
          to="/registrar"
          className="mt-6 flex items-center justify-center gap-2 bg-accent px-4 py-3 font-wordmark text-title-sm uppercase tracking-tighter text-accent-foreground shadow-glow transition-opacity hover:opacity-90"
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden />
          Registrar
        </Link>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <NavLink
            to="/ajustes"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 p-2 transition-colors',
                isActive ? 'text-accent' : 'text-outline hover:text-fg',
              )
            }
          >
            <Settings size={16} strokeWidth={2} aria-hidden />
            <span className="font-mono text-label uppercase">Ajustes</span>
          </NavLink>
          <ThemeToggle />
        </div>
      </nav>

      {/* ── App bar (móvil) ─────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-bg md:hidden">
        <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-edge">
          {/* Dentro de una subsección, el lugar del espaciador lo ocupa el
              botón de volver; el espaciador sólo existe para mantener el
              wordmark ópticamente centrado. */}
          {enSubseccion ? <BotonVolver /> : <span className="w-9" aria-hidden />}
          <Link to="/hoy" className="u-wordmark text-accent">
            Umbral
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="pb-20 pt-16 md:ml-64 md:pb-10 md:pt-0">
        {/* En desktop no hay app bar, así que el volver va acá arriba. */}
        {enSubseccion && (
          <div className="u-page hidden pt-6 md:block">
            <BotonVolver />
          </div>
        )}
        <Outlet />
      </div>

      {/* ── Navegación inferior (móvil) ─────────────────────────────────── */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/95 backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex w-full max-w-md">
          {DESTINOS_MOVIL.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-3 transition-colors',
                    // pb con safe-area para que la barra no quede debajo del
                    // indicador de gestos en iPhone.
                    'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
                    isActive ? 'text-accent' : 'text-outline hover:text-fg',
                  )
                }
              >
                <Icon size={20} strokeWidth={2} aria-hidden />
                <span className="font-mono text-label uppercase">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
