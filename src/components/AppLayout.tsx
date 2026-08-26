import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, CalendarRange, LayoutGrid, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Layout con app bar fijo arriba y navegación inferior.
 *
 * El app bar sale de `design-reference/`: las tres pantallas de Stitch lo
 * llevan, con el wordmark centrado y el borde inferior como único borde de la
 * pantalla. Es lo que le da continuidad a la app entre secciones.
 *
 * Abajo, cuatro destinos como máximo: en mobile, una barra con más de cuatro
 * íconos se vuelve imposible de acertar con el pulgar. Las pantallas del
 * onboarding no usan este layout — ahí la única salida es hacia adelante.
 */
const DESTINOS = [
  { to: '/hoy', label: 'Hoy', Icon: LayoutGrid },
  { to: '/plan', label: 'Plan', Icon: CalendarRange },
  { to: '/analisis', label: 'Análisis', Icon: BarChart3 },
  { to: '/config', label: 'Perfil', Icon: User },
] as const;

export default function AppLayout() {
  return (
    <div className="min-h-dvh bg-bg pb-20 pt-16">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-bg">
        <div className="mx-auto flex h-16 w-full max-w-md items-center justify-center px-edge">
          <span className="u-wordmark text-accent">Umbral</span>
        </div>
      </header>

      <Outlet />

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-bg/95 backdrop-blur"
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
