import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { aDiasDeDominio, crearSesion, guardarPropuesta } from '@/data';
import {
  adaptarPorCargaExterna,
  calcularCargaMetabolica,
  COMPLEMENTARY_ACTIVITIES,
  diasDeRecuperacionQuePide,
  RPE_SCALE,
} from '@/domain';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Chips, Field } from '@/components/ui/field';
import { Aviso, ErrorMensaje } from '@/components/ui/feedback';
import { hoyIso, parsearTiempo, sumarDias } from '@/lib/format';

/**
 * Registrar una actividad que no es correr.
 *
 * Entra al modelo por la misma puerta que cualquier sesión: se guarda en
 * `sessions` con su `discipline`, y su carga metabólica suma al mismo modelo de
 * homeostasis. Que no haya un circuito aparte para las complementarias es
 * deliberado — es lo que hace que un partido de fútbol el sábado se note en el
 * plan del lunes.
 *
 * Al guardar, el motor mira si esa carga pisa una sesión exigente de los
 * próximos días y, si hace falta, deja una propuesta de ajuste.
 */
export default function ComplementariaScreen() {
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);
  const plan = useSession((s) => s.plan);

  const [actividadId, setActividadId] = useState<string>(COMPLEMENTARY_ACTIVITIES[0]!.id);
  const [fecha, setFecha] = useState(hoyIso());
  const [duracion, setDuracion] = useState('');
  const [rpe, setRpe] = useState(6);
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actividad = COMPLEMENTARY_ACTIVITIES.find((a) => a.id === actividadId)!;
  const duracionSeg = parsearTiempo(duracion);
  const duracionIncompleta = duracion.trim() !== '' && duracionSeg === null;

  // La carga se calcula igual que en running y después se ajusta por actividad:
  // una hora de bici no cansa lo mismo que una hora de fútbol al mismo RPE.
  const cargaMetabolica = useMemo(
    () =>
      duracionSeg === null
        ? null
        : Math.round(calcularCargaMetabolica(duracionSeg, rpe) * actividad.factorCarga),
    [duracionSeg, rpe, actividad],
  );

  const diasRecuperacion =
    cargaMetabolica === null ? 0 : diasDeRecuperacionQuePide(cargaMetabolica);

  const puedeGuardar = duracionSeg !== null && !enviando;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!usuario || !puedeGuardar || duracionSeg === null || cargaMetabolica === null) return;

    setEnviando(true);
    setError(null);
    try {
      const sesion = await crearSesion(usuario.id, {
        discipline: actividad.discipline,
        ocurrioEn: `${fecha}T12:00:00`,
        rpe,
        duracionSeg,
        notas: notas.trim() || actividad.label,
        fuente: 'manual',
      });

      // ¿Esta carga pisa algo exigente en los próximos días?
      const semana = plan?.semanas.find(
        (s) => fecha >= s.fechaInicio && fecha <= sumarDias(s.fechaInicio, 6),
      );

      if (semana) {
        const diaActividad = semana.dias.findIndex((d) => d.fecha === fecha);
        if (diaActividad >= 0) {
          const adaptacion = adaptarPorCargaExterna(aDiasDeDominio(semana.dias), {
            diaActividad,
            cargaMetabolica,
            nombreActividad: actividad.label.toLowerCase(),
          });

          await guardarPropuesta(usuario.id, adaptacion, {
            planWeekId: semana.id,
            semanaOriginal: aDiasDeDominio(semana.dias),
            sesionDisparadora: sesion.id,
          });

          navigate('/ajustes');
          return;
        }
      }

      navigate('/hoy');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la actividad.');
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-section px-edge pb-16 pt-8">
      <header>
        <span className="u-label">Actividad complementaria</span>
        <h1 className="u-title mt-unit">¿Qué hiciste?</h1>
        <p className="u-sub mt-2">
          Todo lo que te cansa cuenta, corras o no. Esta carga entra al mismo modelo de
          recuperación que tus entrenamientos.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-section">
        <Chips
          label="Actividad"
          value={actividadId}
          onChange={setActividadId}
          options={COMPLEMENTARY_ACTIVITIES.map((a) => ({ value: a.id, label: a.label }))}
        />

        <section className="flex flex-col gap-gutter">
          <Field
            label="Fecha"
            type="date"
            required
            max={hoyIso()}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />

          <Field
            label="Cuánto duró"
            type="text"
            inputMode="numeric"
            required
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            placeholder="1:30:00"
            error={duracionIncompleta ? 'h:mm:ss o mm:ss.' : null}
          />
        </section>

        <section className="flex flex-col gap-component">
          <span className="u-label">Qué tan duro se sintió (RPE)</span>
          <div className="flex items-center gap-gutter">
            <span className="u-data-sm w-4 text-center text-outline">1</span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="h-1 w-full appearance-none bg-surface-high outline-none accent-accent"
              aria-label="Esfuerzo percibido, de 1 a 10"
            />
            <span className="u-data-sm w-6 text-center text-accent">{rpe}</span>
          </div>
          <p className="u-sub">{RPE_SCALE.find((r) => r.value === rpe)?.label}</p>
        </section>

        {cargaMetabolica !== null && (
          <section>
            <span className="u-label">Carga que suma</span>
            <p className="mt-3 font-hero text-hero-sm text-accent">{cargaMetabolica}</p>
            <p className="u-sub mt-2">
              {diasRecuperacion === 0
                ? 'Es una carga liviana: no debería cambiar nada de tu plan.'
                : `Una carga así pide ${diasRecuperacion === 1 ? 'un día' : 'dos días'} de ` +
                  'recuperación. Si tenías algo exigente justo después, te lo voy a proponer ajustar.'}
            </p>
          </section>
        )}

        <Field
          label="Notas"
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Opcional"
        />

        {!plan && (
          <Aviso>
            Todavía no tenés un plan activo, así que la actividad se guarda pero no hay nada que
            ajustar.
          </Aviso>
        )}

        {error && <ErrorMensaje mensaje={error} />}

        <Button type="submit" size="block" disabled={!puedeGuardar}>
          {enviando ? 'Guardando…' : 'Guardar actividad'}
        </Button>
      </form>
    </main>
  );
}
