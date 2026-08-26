import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { crearSesion, type NuevaSesion } from '@/data';
import { FEELING_SCALE, RPE_SCALE, compararPlanReal, TRAINING_TYPE_TARGETS } from '@/domain';
import { paceMedio, parseActivityFile } from '@/domain/import';
import type { ImportedActivity } from '@/domain/types';
import { useSession } from '@/store/session.store';
import RouteMap from '@/components/RouteMap';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Aviso, ErrorMensaje } from '@/components/ui/feedback';
import {
  formatearKm,
  formatearPaceCorto,
  formatearTiempo,
  hoyIso,
  parsearTiempo,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const CARAS_SENSACION: Record<number, string> = {
  1: '😣',
  2: '🙁',
  3: '😐',
  4: '🙂',
  5: '🤩',
};

/**
 * Registro de sesión: importar un archivo del reloj o cargar todo a mano.
 *
 * Un solo flujo para las dos vías, tal como pide la metodología: el archivo
 * sólo AUTOCOMPLETA los campos objetivos (distancia, tiempo, cadencia…); el
 * RPE y la sensación —los datos que de verdad clasifican la sesión— los
 * escribe siempre la persona, nunca el parser.
 */
export default function RegistrarScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const usuario = useSession((s) => s.usuario);
  const plan = useSession((s) => s.plan);

  const planDayId = searchParams.get('dia');
  const diaPlanificado = useMemo(
    () =>
      planDayId
        ? (plan?.semanas.flatMap((s) => s.dias).find((d) => d.id === planDayId) ?? null)
        : null,
    [plan, planDayId],
  );

  const [fecha, setFecha] = useState(searchParams.get('fecha') ?? hoyIso());
  const [distanciaKm, setDistanciaKm] = useState('');
  const [tiempo, setTiempo] = useState('');
  const [fcPromedio, setFcPromedio] = useState('');
  const [cadencia, setCadencia] = useState('');
  const [rpe, setRpe] = useState(5);
  const [sensacion, setSensacion] = useState<number | null>(null);
  const [notas, setNotas] = useState('');

  const [actividad, setActividad] = useState<ImportedActivity | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [parseando, setParseando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onArchivoSeleccionado(file: File) {
    setParseando(true);
    setErrorArchivo(null);
    try {
      const contenido = await file.text();
      const parsed = parseActivityFile(contenido, { fileName: file.name });
      setActividad(parsed);
      setNombreArchivo(file.name);

      setDistanciaKm((parsed.distanceMeters / 1000).toFixed(2));
      setTiempo(formatearTiempo(parsed.durationSeconds));
      if (parsed.lap?.averageHeartRateBpm) setFcPromedio(String(parsed.lap.averageHeartRateBpm));
      if (parsed.cadenceSpm) setCadencia(String(parsed.cadenceSpm));
    } catch (err) {
      setErrorArchivo(
        err instanceof Error ? err.message : 'No se pudo leer ese archivo.',
      );
      setActividad(null);
      setNombreArchivo(null);
    } finally {
      setParseando(false);
    }
  }

  function quitarArchivo() {
    setActividad(null);
    setNombreArchivo(null);
    setErrorArchivo(null);
    if (inputArchivoRef.current) inputArchivoRef.current.value = '';
  }

  const distanciaNumero = Number(distanciaKm.replace(',', '.'));
  const distanciaValida = distanciaKm === '' || (Number.isFinite(distanciaNumero) && distanciaNumero > 0);
  const tiempoSeg = parsearTiempo(tiempo);
  const tiempoIncompleto = tiempo.trim() !== '' && tiempoSeg === null;

  const paceCalculado =
    actividad?.paceSecPerKm ??
    (distanciaValida && distanciaNumero > 0 && tiempoSeg
      ? paceMedio(distanciaNumero * 1000, tiempoSeg)
      : null);

  const comparacion = useMemo(() => {
    if (!diaPlanificado || distanciaNumero <= 0) return null;
    return compararPlanReal(
      { km: diaPlanificado.km, targetRpe: diaPlanificado.rpeObjetivo ?? undefined },
      { distanceMeters: distanciaNumero * 1000, rpe },
    );
  }, [diaPlanificado, distanciaNumero, rpe]);

  const puedeGuardar = distanciaValida && !tiempoIncompleto && !enviando;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!usuario || !puedeGuardar) return;

    setEnviando(true);
    setError(null);
    try {
      const payload: NuevaSesion = {
        planDayId: diaPlanificado?.id ?? null,
        trainingType: diaPlanificado?.tipo,
        ocurrioEn: `${fecha}T12:00:00`,
        rpe,
        sensacion,
        duracionSeg: tiempoSeg ?? undefined,
        distanciaMetros: distanciaNumero > 0 ? distanciaNumero * 1000 : undefined,
        paceSegPorKm: paceCalculado ?? undefined,
        fcPromedio: fcPromedio ? Number(fcPromedio) : undefined,
        cadenciaSpm: cadencia ? Number(cadencia) : undefined,
        fuente: actividad?.format ?? 'manual',
        track: actividad?.points,
        splits: actividad?.splits,
        avisosImportacion: actividad?.warnings,
        notas: notas.trim() || undefined,
      };

      const sesion = await crearSesion(usuario.id, payload);
      navigate(`/sesion/${sesion.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la sesión.');
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">Registrar</p>
        <h1 className="mt-6 font-display text-2xl font-semibold">
          {diaPlanificado ? TRAINING_TYPE_TARGETS[diaPlanificado.tipo].label : 'Nueva sesión'}
        </h1>
        {diaPlanificado && (
          <p className="u-sub mt-2">
            Planificado: {formatearKm(diaPlanificado.km)} km
            {diaPlanificado.rpeObjetivo && ` · RPE ${diaPlanificado.rpeObjetivo}`}
            {diaPlanificado.zonaObjetivo && ` · Zona ${diaPlanificado.zonaObjetivo}`}
          </p>
        )}
      </header>

      <form onSubmit={onSubmit}>
        {/* ── Importar ────────────────────────────────────────────────────── */}
        <section className="u-section border-t border-border">
          <h2 className="u-section-title">Importar del reloj</h2>
          <p className="u-sub mt-1">TCX, GPX o KML. Opcional: podés cargar todo a mano.</p>

          <input
            ref={inputArchivoRef}
            type="file"
            accept=".tcx,.gpx,.kml"
            className="sr-only"
            id="archivo-actividad"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onArchivoSeleccionado(file);
            }}
          />

          {!actividad ? (
            <label
              htmlFor="archivo-actividad"
              className="mt-6 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border py-8 text-center"
            >
              <span className="u-sub">
                {parseando ? 'Leyendo el archivo…' : 'Tocá para elegir un archivo'}
              </span>
            </label>
          ) : (
            <div className="mt-6">
              {actividad.points.length > 0 && (
                <RouteMap track={actividad.points} heightClassName="h-48" className="mb-4" />
              )}
              <div className="flex items-center justify-between">
                <p className="u-sub truncate">{nombreArchivo}</p>
                <button
                  type="button"
                  onClick={quitarArchivo}
                  className="shrink-0 text-sm text-accent underline underline-offset-4"
                >
                  Quitar
                </button>
              </div>
              {actividad.warnings.map((aviso) => (
                <Aviso key={aviso} className="mt-3">
                  {aviso}
                </Aviso>
              ))}
            </div>
          )}

          {errorArchivo && <ErrorMensaje mensaje={errorArchivo} className="mt-4" />}
        </section>

        {/* ── Datos objetivos ─────────────────────────────────────────────── */}
        <section className="u-section border-t border-border space-y-8">
          <h2 className="u-section-title">Datos de la sesión</h2>

          <Field
            label="Fecha"
            type="date"
            required
            max={hoyIso()}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-6">
            <Field
              label="Distancia"
              type="text"
              inputMode="decimal"
              value={distanciaKm}
              onChange={(e) => setDistanciaKm(e.target.value)}
              placeholder="10"
              suffix="km"
              error={!distanciaValida ? 'Tiene que ser un número positivo.' : null}
              disabled={actividad !== null}
            />
            <Field
              label="Tiempo"
              type="text"
              inputMode="numeric"
              value={tiempo}
              onChange={(e) => setTiempo(e.target.value)}
              placeholder="52:00"
              error={tiempoIncompleto ? 'h:mm:ss o mm:ss.' : null}
              disabled={actividad !== null}
            />
          </div>

          {paceCalculado !== null && (
            <p className="u-sub">Pace: {formatearPaceCorto(paceCalculado)}/km</p>
          )}

          <div className="grid grid-cols-2 gap-6">
            <Field
              label="FC promedio"
              type="number"
              inputMode="numeric"
              min={30}
              max={240}
              value={fcPromedio}
              onChange={(e) => setFcPromedio(e.target.value)}
              placeholder="Opcional"
              suffix="ppm"
              hint="Secundario. El reloj mide mal."
            />
            <Field
              label="Cadencia"
              type="number"
              inputMode="numeric"
              value={cadencia}
              onChange={(e) => setCadencia(e.target.value)}
              placeholder="Opcional"
              suffix="spm"
            />
          </div>
        </section>

        {/* ── Percepción de esfuerzo (lo que de verdad manda) ────────────── */}
        <section className="u-section border-t border-border">
          <h2 className="u-section-title">Cómo lo sentiste</h2>
          <p className="u-sub mt-1">
            Esto es lo que clasifica la sesión, más que cualquier dato del reloj.
          </p>

          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <p className="u-label">Esfuerzo percibido (RPE)</p>
              <span className="font-hero text-hero-sm text-accent">{rpe}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="mt-4 w-full accent-accent"
              aria-label="Esfuerzo percibido, de 1 a 10"
            />
            <p className="u-sub mt-2">{RPE_SCALE.find((r) => r.value === rpe)?.label}</p>
          </div>

          <div className="mt-8">
            <p className="u-label">Sensación general</p>
            <div className="mt-4 flex justify-between gap-2">
              {FEELING_SCALE.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={sensacion === f.value}
                  aria-label={f.label}
                  onClick={() => setSensacion(f.value)}
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full text-2xl transition-colors',
                    sensacion === f.value ? 'bg-accent' : 'bg-surface',
                  )}
                >
                  {CARAS_SENSACION[f.value]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {comparacion && (
          <section className="u-section border-t border-border">
            <h2 className="u-section-title">Contra lo planificado</h2>
            <p className="u-sub mt-3">
              Planificado {formatearKm(comparacion.kmPlanificados)} km
              {comparacion.rpeObjetivo && ` a RPE ${comparacion.rpeObjetivo}`} · Corriste{' '}
              {formatearKm(comparacion.kmReales)} km a RPE {comparacion.rpeReal}
              {comparacion.diferenciaKm !== 0 &&
                ` (${comparacion.diferenciaKm > 0 ? '+' : ''}${formatearKm(comparacion.diferenciaKm)} km)`}
              .
            </p>
            {comparacion.esfuerzoPorEncimaDeLoEsperado && (
              <Aviso className="mt-3">
                Se sintió bastante más duro de lo planificado. Puede valer la pena meter una
                Recuperación antes del próximo Específico.
              </Aviso>
            )}
          </section>
        )}

        <section className="u-section border-t border-border">
          <Field
            label="Notas"
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Opcional"
          />
        </section>

        <section className="u-section border-t border-border">
          {error && <ErrorMensaje mensaje={error} className="mb-6" />}
          <Button type="submit" size="block" disabled={!puedeGuardar}>
            {enviando ? 'Guardando…' : 'Guardar sesión'}
          </Button>
        </section>
      </form>
    </main>
  );
}
