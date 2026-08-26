import { NavLink, Outlet } from 'react-router-dom';
import { Activity, CalendarRange, Gauge, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Layout con navegación inferior.
 *
 * Cuatro destinos como máximo: en mobile, una barra con más de cuatro íconos se
 * vuelve imposible de acertar con el pulgar. Las pantallas del onboarding no
 * usan este layout — ahí la única salida es hacia adelante.
 */
const DESTINOS = [
  { to: '/plan', label: 'Plan', Icon: CalendarRange },
  { to: '/zonas', label: 'Zonas', Icon: Gauge },
  { to: '/umbral', label: 'Umbral', Icon: Activity },
  { to: '/config', label: 'Ajustes', Icon: Settings },
] as const;

export default function AppLayout() {
  return (
    <div className="min-h-dvh bg-bg pb-20">
      <Outlet />

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 backdrop-blur"
      >
        <ul className="mx-auto flex w-full max-w-md">
          {DESTINOS.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-3 transition-colors',
                    // pb con safe-area para que la barra no quede debajo del
                    // indicador de gestos en iPhone.
                    'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
                    isActive ? 'text-accent' : 'text-fg-muted hover:text-fg',
                  )
                }
              >
                <Icon size={20} strokeWidth={2} aria-hidden />
                <span className="text-label uppercase">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
