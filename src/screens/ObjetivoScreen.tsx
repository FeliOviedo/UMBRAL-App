import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { crearObjetivo, guardarPlan } from '@/data';
import {
  DEFAULT_MESOCYCLE_SCHEME,
  MACROCYCLE_TABLE,
  MESOCYCLE_SCHEMES,
  feasibilidadObjetivo,
  generarMacrociclo,
  nivelPorObjetivo,
  semanasEntre,
} from '@/domain';
import type { MesocycleScheme, RaceDistance } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Chips, Field } from '@/components/ui/field';
import { Aviso, ErrorMensaje } from '@/components/ui/feedback';
import { formatearTiempo, hoyIso, parsearTiempo } from '@/lib/format';

const DISTANCIAS: readonly { value: RaceDistance; label: string }[] = [
  { value: '5K', label: '5K' },
  { value: '10K', label: '10K' },
  { value: '21K', label: '21K' },
  { value: '42K', label: '42K' },
];

/**
 * Definir el objetivo y generar el plan.
 *
 * Todo lo que se muestra mientras el usuario completa —nivel, días por semana,
 * feasibilidad— sale de correr el dominio en vivo. Nada se guarda hasta que se
 * confirma: es una previsualización real, no una estimación aparte que después
 * podría no coincidir con el plan generado.
 */
export default function ObjetivoScreen() {
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);
  const perfil = useSession((s) => s.perfil);
  const setObjetivo = useSession((s) => s.setObjetivo);
  const setPlan = useSession((s) => s.setPlan);

  const [distancia, setDistancia] = useState<RaceDistance>('10K');
  const [tiempo, setTiempo] = useState('');
  const [fechaCarrera, setFechaCarrera] = useState('');
  const [esquema, setEsquema] = useState<MesocycleScheme>(DEFAULT_MESOCYCLE_SCHEME);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inicio = hoyIso();
  const tiempoSeg = parsearTiempo(tiempo);
  const tiempoIncompleto = tiempo.trim() !== '' && tiempoSeg === null;

  /**
   * Previsualización: el mismo plan que se va a guardar.
   *
   * Se recalcula con cada cambio. Es barato —son funciones puras sobre tablas
   * chicas— y es lo que hace que el usuario entienda el efecto de mover la
   * fecha antes de comprometerse.
   */
  const preview = useMemo(() => {
    if (tiempoSeg === null || !fechaCarrera || !perfil?.ritmoBase || !perfil.volumenSemanalKm) {
      return null;
    }
    if (fechaCarrera < inicio) return null;

    const nivel = nivelPorObjetivo(distancia, tiempoSeg);
    const semanas = semanasEntre(inicio, fechaCarrera);
    const feasibilidad = feasibilidadObjetivo(distancia, semanas);
    const macrociclo = generarMacrociclo({
      distance: distancia,
      targetSeconds: tiempoSeg,
      startDate: inicio,
      raceDate: fechaCarrera,
      volumenActualKm: perfil.volumenSemanalKm,
      ritmoBase: perfil.ritmoBase,
      scheme: esquema,
    });

    return { nivel, semanas, feasibilidad, macrociclo };
  }, [distancia, tiempoSeg, fechaCarrera, esquema, perfil, inicio]);

  const faltaPerfil = !perfil?.ritmoBase || !perfil.volumenSemanalKm;
  const puedeGuardar = preview !== null && !enviando && !faltaPerfil;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!usuario || !preview || !perfil?.ritmoBase || !perfil.volumenSemanalKm) return;

    setEnviando(true);
    setError(null);
    try {
      const objetivo = await crearObjetivo(usuario.id, {
        distancia,
        tiempoObjetivoSeg: tiempoSeg!,
        fechaCarrera,
        fechaInicio: inicio,
      });

      const plan = await guardarPlan(usuario.id, objetivo.id, preview.macrociclo, {
        esquema,
        diasPorSemana: preview.nivel.diasRecomendados,
        ritmoBase: perfil.ritmoBase,
        volumenInicialKm: perfil.volumenSemanalKm,
      });

      setObjetivo(objetivo);
      setPlan(plan);
      navigate('/plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el plan.');
      setEnviando(false);
    }
  }

  if (faltaPerfil) {
    return (
      <main className="mx-auto w-full max-w-md px-edge pb-16">
        <div className="u-section">
          <h1 className="u-title">Falta un paso antes</h1>
          <p className="u-sub mt-3">
            Para armar el plan necesitamos saber cuántos km corrés por semana y a qué ritmo.
          </p>
          <Button size="block" className="mt-8" onClick={() => navigate('/onboarding')}>
            Completar mi perfil
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-edge pb-16">
      <header className="u-section">
        <p className="u-label">Paso 3 de 3</p>
        <h1 className="mt-6 u-title">Tu objetivo</h1>
        <p className="u-sub mt-3">
          El tiempo que buscás define cuántos días por semana vas a entrenar y cómo progresa el
          volumen.
        </p>
      </header>

      <form onSubmit={onSubmit}>
        <section className="u-section space-y-10">
          <Chips
            label="Distancia"
            value={distancia}
            onChange={setDistancia}
            options={DISTANCIAS}
          />

          <Field
            label="Tiempo objetivo"
            type="text"
            inputMode="numeric"
            required
            value={tiempo}
            onChange={(e) => setTiempo(e.target.value)}
            placeholder={distancia === '5K' ? '25:00' : '0:52:00'}
            error={tiempoIncompleto ? 'Escribilo como h:mm:ss o mm:ss.' : null}
            hint="En qué tiempo querés terminar. Sé realista: de esto salen los días de entrenamiento."
          />

          <Field
            label="Fecha de la carrera"
            type="date"
            required
            min={inicio}
            value={fechaCarrera}
            onChange={(e) => setFechaCarrera(e.target.value)}
            hint={`El plan ideal para ${distancia} usa ${MACROCYCLE_TABLE[distancia].totalWeeks} semanas.`}
          />

          <Chips
            label="Cómo tolerás la carga"
            value={esquema}
            onChange={setEsquema}
            options={(Object.keys(MESOCYCLE_SCHEMES) as MesocycleScheme[]).map((s) => ({
              value: s,
              label: s,
              hint: MESOCYCLE_SCHEMES[s].level,
            }))}
            hint="Cuántas semanas de carga por cada semana de descarga. 3:1 es lo recomendado si no estás seguro."
          />
        </section>

        {preview && (
          <section className="u-section">
            <h2 className="u-label">Así queda tu plan</h2>

            <div className="mt-8 flex items-baseline gap-6">
              <div>
                <p className="font-hero text-hero-sm">{preview.macrociclo.totalWeeks}</p>
                <p className="u-label mt-2">Semanas</p>
              </div>
              <div>
                <p className="font-hero text-hero-sm">{preview.nivel.diasRecomendados}</p>
                <p className="u-label mt-2">Días/semana</p>
              </div>
              <div>
                <p className="font-hero text-hero-sm">{preview.macrociclo.baseWeeks}</p>
                <p className="u-label mt-2">De base</p>
              </div>
            </div>

            <p className="u-sub mt-6">
              {formatearTiempo(tiempoSeg!)} en {distancia} te ubica en{' '}
              {preview.nivel.daysMin === preview.nivel.daysMax
                ? `${preview.nivel.daysMax} días`
                : `${preview.nivel.daysMin}-${preview.nivel.daysMax} días`}{' '}
              por semana. Después de la carrera vas a necesitar{' '}
              {preview.macrociclo.postRaceRestWeeks} semanas de descanso.
            </p>

            {preview.macrociclo.warnings.map((aviso) => (
              <Aviso key={aviso} className="mt-6">
                {aviso}
              </Aviso>
            ))}
          </section>
        )}

        <section className="u-section">
          {error && <ErrorMensaje mensaje={error} className="mb-6" />}
          <Button type="submit" size="block" disabled={!puedeGuardar}>
            {enviando ? 'Generando tu plan…' : 'Generar mi plan'}
          </Button>
          {!preview && !tiempoIncompleto && (
            <p className="u-sub mt-4 text-center">
              Completá el tiempo y la fecha para ver cómo queda.
            </p>
          )}
        </section>
      </form>
    </main>
  );
}
