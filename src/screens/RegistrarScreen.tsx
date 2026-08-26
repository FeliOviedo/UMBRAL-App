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
    <main className="mx-auto flex w-full max-w-md flex-col gap-section px-edge pb-16 pt-8">
      <header className="flex flex-col items-center text-center">
        <span className="u-label">
          {diaPlanificado ? TRAINING_TYPE_TARGETS[diaPlanificado.tipo].label : 'Nueva sesión'}
        </span>
        <h1 className="u-title mt-unit uppercase">
          {actividad ? '¡Entrenamiento completado!' : 'Registrar sesión'}
        </h1>
      </header>

      {/*
        Métricas hero: sólo aparecen cuando hay datos. Es el bloque que Stitch
        pone arriba de todo — dos números de 56px y nada más compitiendo.
      */}
      {(distanciaNumero > 0 || tiempoSeg !== null) && (
        <section className="flex items-start justify-center gap-gutter">
          {distanciaNumero > 0 && (
            <div className="flex flex-1 flex-col items-center">
              <span className="u-hero">{formatearKm(distanciaNumero)}</span>
              <span className="u-label mt-unit tracking-widest">Kilómetros</span>
            </div>
          )}
          {tiempoSeg !== null && distanciaNumero > 0 && (
            <div aria-hidden className="mt-3 h-16 w-px bg-border" />
          )}
          {tiempoSeg !== null && (
            <div className="flex flex-1 flex-col items-center">
              <span className="u-hero">{formatearTiempo(tiempoSeg)}</span>
              <span className="u-label mt-unit tracking-widest">Tiempo total</span>
            </div>
          )}
        </section>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-section">
        {/* ── Importar ────────────────────────────────────────────────────── */}
        <section>
          <span className="u-label">Importar del reloj</span>
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
              className="mt-component flex cursor-pointer items-center justify-center border border-dashed border-border py-8 text-center"
            >
              <span className="u-sub">
                {parseando ? 'Leyendo el archivo…' : 'Tocá para elegir un archivo'}
              </span>
            </label>
          ) : (
            <div className="mt-component">
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
        <section className="flex flex-col gap-gutter">
          <span className="u-label">Datos de la sesión</span>

          <Field
            label="Fecha"
            type="date"
            required
            max={hoyIso()}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-gutter">
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

          <div className="grid grid-cols-2 gap-gutter">
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
        <section className="flex flex-col gap-gutter">
          <div className="flex flex-col gap-component">
            <span className="u-label">Esfuerzo percibido (RPE)</span>
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
          </div>

          <div className="flex flex-col gap-component">
            <span className="u-label">¿Cómo te sentiste?</span>
            <div className="flex justify-between gap-unit">
              {FEELING_SCALE.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={sensacion === f.value}
                  aria-label={f.label}
                  onClick={() => setSensacion(f.value)}
                  className={cn(
                    'flex h-12 w-12 items-center justify-center border text-2xl transition-colors',
                    sensacion === f.value
                      ? 'border-accent bg-surface-high'
                      : 'border-transparent bg-surface hover:bg-surface-high',
                  )}
                >
                  {CARAS_SENSACION[f.value]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/*
          Comparación plan vs. real, con las barras de Stitch: el fondo marca
          lo planificado (100%) y la barra de acento lo hecho, que puede pasarse
          del 100%. Se ve de un vistazo si te quedaste corto o te pasaste.
        */}
        {comparacion && (
          <section className="flex flex-col gap-gutter">
            <span className="u-label">Contra lo planificado</span>

            <BarraComparativa
              etiqueta="Distancia"
              real={formatearKm(comparacion.kmReales)}
              objetivo={`${formatearKm(comparacion.kmPlanificados)} km`}
              fraccion={
                comparacion.kmPlanificados > 0
                  ? comparacion.kmReales / comparacion.kmPlanificados
                  : 1
              }
            />

            {comparacion.rpeObjetivo !== null && (
              <BarraComparativa
                etiqueta="Esfuerzo (RPE)"
                real={String(comparacion.rpeReal)}
                objetivo={`RPE ${comparacion.rpeObjetivo}`}
                fraccion={comparacion.rpeReal / comparacion.rpeObjetivo}
                // Pasarse de esfuerzo no es un logro: se marca en ámbar.
                excesoEsMalo
              />
            )}

            {comparacion.esfuerzoPorEncimaDeLoEsperado && (
              <Aviso>
                Se sintió bastante más duro de lo planificado. Puede valer la pena meter una
                Recuperación antes del próximo Específico.
              </Aviso>
            )}
          </section>
        )}

        <section>
          <Field
            label="Notas"
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Opcional"
          />
        </section>

        <section>
          {error && <ErrorMensaje mensaje={error} className="mb-gutter" />}
          <Button type="submit" size="block" disabled={!puedeGuardar}>
            {enviando ? 'Guardando…' : 'Guardar y analizar'}
          </Button>
        </section>
      </form>
    </main>
  );
}

/**
 * Barra de comparación entre lo planificado y lo real.
 *
 * El fondo gris representa el 100% de lo planificado; la barra de acento, lo
 * que efectivamente se hizo. Puede pasar del 100% (se recorta al ancho del
 * contenedor), que es justamente lo que hace legible "me pasé".
 */
function BarraComparativa({
  etiqueta,
  real,
  objetivo,
  fraccion,
  excesoEsMalo = false,
}: {
  etiqueta: string;
  real: string;
  objetivo: string;
  fraccion: number;
  excesoEsMalo?: boolean;
}) {
  const excedido = fraccion > 1;
  const color = excedido && excesoEsMalo ? 'bg-zone-z4' : 'bg-accent';

  return (
    <div>
      <div className="mb-unit flex items-end justify-between">
        <span className="u-label">{etiqueta}</span>
        <div className="text-right">
          <span className="u-data-sm">{real}</span>
          <span className="u-label"> / {objetivo}</span>
        </div>
      </div>
      <div className="relative h-2 w-full overflow-hidden bg-surface-high">
        <div
          className={cn('absolute left-0 h-full', color)}
          style={{ width: `${Math.min(100, Math.round(fraccion * 100))}%` }}
        />
      </div>
    </div>
  );
}
