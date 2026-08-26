import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { supabaseConfigurado } from '@/lib/supabase';
import { useSession } from '@/store/session.store';
import AppLayout from '@/components/AppLayout';
import { Cargando, ErrorMensaje } from '@/components/ui/feedback';
import LoginScreen from '@/screens/LoginScreen';
import OnboardingScreen from '@/screens/OnboardingScreen';
import UmbralScreen from '@/screens/UmbralScreen';
import ZonasScreen from '@/screens/ZonasScreen';
import ObjetivoScreen from '@/screens/ObjetivoScreen';
import PlanScreen from '@/screens/PlanScreen';
import MesocicloScreen from '@/screens/MesocicloScreen';
import SemanaScreen from '@/screens/SemanaScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import ConfigScreen from '@/screens/ConfigScreen';

/**
 * Estas dos pantallas se cargan bajo demanda porque arrastran las dependencias
 * pesadas del proyecto: el parser de XML (importar archivos) y Leaflet (el
 * mapa). Son ~275 kB que no tienen por qué estar en el arranque, cuando la
 * mayoría de las visitas van al dashboard o al plan.
 */
const RegistrarScreen = lazy(() => import('@/screens/RegistrarScreen'));
const SesionDetalleScreen = lazy(() => import('@/screens/SesionDetalleScreen'));

export default function App() {
  const inicializar = useSession((s) => s.inicializar);

  useEffect(() => inicializar(), [inicializar]);

  if (!supabaseConfigurado) return <FaltaConfiguracion />;

  return (
    <BrowserRouter>
      <Rutas />
    </BrowserRouter>
  );
}

function Rutas() {
  const usuario = useSession((s) => s.usuario);
  const perfil = useSession((s) => s.perfil);
  const cargandoDatos = useSession((s) => s.cargandoDatos);
  const error = useSession((s) => s.error);
  const recargarDatos = useSession((s) => s.recargarDatos);

  // undefined = todavía no sabemos si hay sesión. Mostrar el login acá haría
  // parpadear la pantalla de entrada en cada recarga.
  if (usuario === undefined) return <Cargando mensaje="Abriendo Umbral…" />;

  if (usuario === null) {
    return (
      <Routes>
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    );
  }

  if (cargandoDatos && perfil === null) return <Cargando mensaje="Cargando tus datos…" />;

  if (error) {
    return (
      <main className="mx-auto w-full max-w-md px-6 py-section">
        <ErrorMensaje mensaje={error} onReintentar={() => void recargarDatos()} />
      </main>
    );
  }

  return (
    <Routes>
      {/* El onboarding vive fuera del layout: no hay a dónde navegar todavía. */}
      <Route path="/onboarding" element={<OnboardingScreen />} />

      <Route element={<AppLayout />}>
        <Route path="/hoy" element={<DashboardScreen />} />
        <Route path="/umbral" element={<UmbralScreen />} />
        <Route path="/zonas" element={<ZonasScreen />} />
        <Route path="/objetivo" element={<ObjetivoScreen />} />
        <Route path="/plan" element={<PlanScreen />} />
        <Route path="/plan/mesociclo/:index" element={<MesocicloScreen />} />
        <Route path="/plan/semana/:numero" element={<SemanaScreen />} />
        <Route
          path="/registrar"
          element={
            <Suspense fallback={<Cargando mensaje="Abriendo el registro…" />}>
              <RegistrarScreen />
            </Suspense>
          }
        />
        <Route
          path="/sesion/:id"
          element={
            <Suspense fallback={<Cargando mensaje="Cargando sesión…" />}>
              <SesionDetalleScreen />
            </Suspense>
          }
        />
        <Route path="/config" element={<ConfigScreen />} />
      </Route>

      <Route path="*" element={<Navigate to={destinoInicial(perfil?.onboardingCompleto)} replace />} />
    </Routes>
  );
}

/** A dónde mandar a alguien que entra sin ruta: al onboarding o al día de hoy. */
function destinoInicial(onboardingCompleto: boolean | undefined): string {
  return onboardingCompleto ? '/hoy' : '/onboarding';
}

/**
 * Pantalla de "falta configurar Supabase".
 *
 * Sin esto, alguien que clona el repo y corre `npm run dev` se come un error de
 * red sin explicación. Es el primer tropiezo de cualquiera que arranca.
 */
function FaltaConfiguracion() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <p className="u-label">Umbral</p>
      <h1 className="mt-6 font-display text-2xl font-semibold">Falta conectar Supabase</h1>
      <p className="u-sub mt-4">
        Copiá <code className="font-mono text-fg">.env.example</code> a{' '}
        <code className="font-mono text-fg">.env</code> y completá las dos variables con los datos
        de tu proyecto:
      </p>
      <ul className="mt-4 space-y-1">
        <li className="u-table text-fg">VITE_SUPABASE_URL</li>
        <li className="u-table text-fg">VITE_SUPABASE_ANON_KEY</li>
      </ul>
      <p className="u-sub mt-6">
        Los pasos completos están en el <code className="font-mono text-fg">README.md</code>.
        Después reiniciá el servidor de desarrollo.
      </p>
    </main>
  );
}
