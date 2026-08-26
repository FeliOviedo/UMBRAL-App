import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Vuelve a la pantalla anterior.
 *
 * Las rutas raíz de la navegación no lo muestran: ahí "atrás" saldría de la
 * app o llevaría a un lugar arbitrario. En todo lo demás —el detalle de una
 * sesión, una semana, un mesociclo— entrar sin forma de volver obliga a usar el
 * gesto del navegador, que en una PWA instalada puede no existir.
 *
 * Cuando no hay historial propio (se entró por link directo o recargando),
 * `navigate(-1)` no tiene a dónde ir: en ese caso se cae al destino padre, que
 * cada ruta declara acá.
 */
const RAICES = ['/hoy', '/plan', '/analisis', '/config', '/calendario', '/volumen'];

/** A dónde caer si no hay historial. La entrada más específica gana. */
const PADRES: readonly { prefijo: string; padre: string; etiqueta: string }[] = [
  { prefijo: '/plan/semana', padre: '/plan', etiqueta: 'Plan' },
  { prefijo: '/plan/mesociclo', padre: '/plan', etiqueta: 'Plan' },
  { prefijo: '/sesion', padre: '/calendario', etiqueta: 'Calendario' },
  { prefijo: '/registrar', padre: '/hoy', etiqueta: 'Hoy' },
  { prefijo: '/complementaria', padre: '/hoy', etiqueta: 'Hoy' },
  { prefijo: '/ajustes', padre: '/hoy', etiqueta: 'Hoy' },
  { prefijo: '/zonas', padre: '/config', etiqueta: 'Perfil' },
  { prefijo: '/umbral', padre: '/config', etiqueta: 'Perfil' },
  { prefijo: '/objetivo', padre: '/plan', etiqueta: 'Plan' },
];

export function esRutaRaiz(pathname: string): boolean {
  return RAICES.includes(pathname);
}

export default function BotonVolver({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { pathname, key } = useLocation();

  if (esRutaRaiz(pathname)) return null;

  const destino = PADRES.find((p) => pathname.startsWith(p.prefijo));

  const volver = () => {
    // `key === 'default'` significa que esta es la primera entrada del
    // historial: no hay atrás al que volver dentro de la app.
    if (key !== 'default') navigate(-1);
    else navigate(destino?.padre ?? '/hoy');
  };

  return (
    <button
      type="button"
      onClick={volver}
      className={cn(
        'flex items-center gap-2 py-2 text-outline transition-colors hover:text-fg',
        className,
      )}
    >
      <ArrowLeft size={18} strokeWidth={2} aria-hidden />
      <span className="font-mono text-label uppercase">{destino?.etiqueta ?? 'Volver'}</span>
    </button>
  );
}
