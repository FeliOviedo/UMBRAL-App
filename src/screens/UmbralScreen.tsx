import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { guardarUmbral, type ThresholdSource } from '@/data';
import { calcularLTHR, calcularPaceUmbral, THRESHOLD_TEST } from '@/domain';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Chips, Field } from '@/components/ui/field';
import { Aviso, ErrorMensaje } from '@/components/ui/feedback';
import { formatearPaceCorto, parsearPace } from '@/lib/format';

type MetodoFc = 'test_30min' | 'test_20min' | 'manual' | 'ninguno';

/**
 * Carga del umbral: el único dato del que se deriva todo lo demás.
 *
 * Dos entradas independientes, y con una alcanza:
 *
 * - FC (LTHR): por test de 30 o 20 min, o a mano si el usuario ya la sabe.
 * - Pace: por test de 20 min. Es OPCIONAL pero se recomienda fuerte, porque la
 *   FC del reloj es poco fiable y el pace es el ancla objetiva que sí lo es.
 *
 * La app calcula en vivo mientras el usuario escribe: ver el resultado antes de
 * guardar es lo que hace entendible la corrección del 5%.
 */
export default function UmbralScreen() {
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);
  const setUmbral = useSession((s) => s.setUmbral);

  const [metodoFc, setMetodoFc] = useState<MetodoFc>('test_30min');
  const [valorFc, setValorFc] = useState('');
  const [pacePorKm, setPacePorKm] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fcNumero = Number(valorFc);
  const fcValida = Number.isFinite(fcNumero) && fcNumero >= 80 && fcNumero <= 240;

  // El resultado se recalcula en cada tecla: el usuario ve la corrección aplicada.
  const lthr =
    metodoFc === 'ninguno' || !fcValida
      ? null
      : metodoFc === 'manual'
        ? Math.round(fcNumero)
        : calcularLTHR(fcNumero, metodoFc === 'test_30min' ? '30min' : '20min');

  const paceTest = parsearPace(pacePorKm);
  const paceUmbral = paceTest === null ? null : calcularPaceUmbral(paceTest);

  const paceIncompleto = pacePorKm.trim() !== '' && paceTest === null;
  const puedeGuardar = (lthr !== null || paceUmbral !== null) && !paceIncompleto;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!usuario || !puedeGuardar) return;

    setEnviando(true);
    setError(null);
    try {
      const guardado = await guardarUmbral(usuario.id, {
        lthr,
        pacePorKm: paceUmbral,
        origenLthr: metodoFc === 'ninguno' ? null : (metodoFc satisfies ThresholdSource),
        origenPace: paceUmbral !== null ? 'test_20min' : null,
        testFcPromedio: metodoFc === 'manual' || metodoFc === 'ninguno' ? null : fcNumero,
        testPacePromedio: paceTest,
      });
      setUmbral(guardado);
      navigate('/zonas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar tu umbral.');
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">Paso 2 de 3</p>
        <h1 className="mt-6 font-display text-3xl font-semibold leading-tight">Tu umbral</h1>
        <p className="u-sub mt-3">
          De este dato salen las siete zonas. Con cargar uno de los dos alcanza, pero el pace es
          el más confiable: los relojes miden mal las pulsaciones.
        </p>
      </header>

      <form onSubmit={onSubmit}>
        {/* ── Frecuencia cardíaca ─────────────────────────────────────────── */}
        <section className="u-section border-t border-border">
          <h2 className="u-section-title">Frecuencia cardíaca</h2>
          <p className="u-sub mt-1">Dato secundario. Podés saltearlo.</p>

          <div className="mt-6">
            <Chips
              label="Cómo lo conseguiste"
              value={metodoFc}
              onChange={(m) => setMetodoFc(m)}
              options={[
                { value: 'test_30min', label: 'Test 30 min' },
                { value: 'test_20min', label: 'Test 20 min' },
                { value: 'manual', label: 'Ya la sé' },
                { value: 'ninguno', label: 'Saltear' },
              ]}
            />
          </div>

          {metodoFc !== 'ninguno' && (
            <div className="mt-8">
              <Field
                label={
                  metodoFc === 'manual'
                    ? 'Tu LTHR'
                    : metodoFc === 'test_30min'
                      ? 'FC promedio de los últimos 20 min'
                      : 'FC promedio de los 20 min'
                }
                type="number"
                inputMode="numeric"
                min={80}
                max={240}
                value={valorFc}
                onChange={(e) => setValorFc(e.target.value)}
                placeholder="168"
                suffix="ppm"
                error={valorFc !== '' && !fcValida ? 'Tiene que estar entre 80 y 240 ppm.' : null}
                hint={
                  metodoFc === 'test_30min'
                    ? `Corré ${THRESHOLD_TEST.lthrTestMinutes.long} min al máximo que puedas sostener y promediá la FC de los últimos ${THRESHOLD_TEST.lthrAveragingWindowMinutes} min.`
                    : metodoFc === 'test_20min'
                      ? `Corré ${THRESHOLD_TEST.lthrTestMinutes.short} min al máximo sostenible. Le restamos un 5% porque 20 min se corren por encima del umbral real.`
                      : 'Si ya hiciste el test en otro lado, cargala directo.'
                }
              />

              {lthr !== null && metodoFc === 'test_20min' && (
                <p className="u-sub mt-3">
                  Con la corrección del 5%, tu LTHR es{' '}
                  <span className="font-mono text-fg">{lthr} ppm</span>.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Pace ────────────────────────────────────────────────────────── */}
        <section className="u-section border-t border-border">
          <h2 className="u-section-title">Pace de umbral</h2>
          <p className="u-sub mt-1">Recomendado. Es el ancla que no depende del reloj.</p>

          <div className="mt-6">
            <Field
              label="Pace promedio de un test de 20 min"
              type="text"
              inputMode="numeric"
              value={pacePorKm}
              onChange={(e) => setPacePorKm(e.target.value)}
              placeholder="4:40"
              suffix="/km"
              error={paceIncompleto ? 'Escribilo como minutos:segundos, por ejemplo 4:40.' : null}
              hint={`Corré ${THRESHOLD_TEST.paceTestMinutes} min parejo, lo más rápido que puedas sostener, y anotá el pace promedio.`}
            />
          </div>

          {paceUmbral !== null && (
            <div className="mt-8">
              <p className="u-label">Tu pace de umbral</p>
              <p className="mt-3 u-hero">
                {formatearPaceCorto(paceUmbral)}
                <span className="ml-2 font-sans text-base font-medium text-fg-muted">/km</span>
              </p>
              <p className="u-sub mt-3">
                Es el techo de la Z4: el ritmo que podrías sostener una hora. Sale de aflojar un{' '}
                {Math.round((THRESHOLD_TEST.pace20MinFactor - 1) * 100)}% el pace de tu test de 20
                min.
              </p>
            </div>
          )}
        </section>

        <section className="u-section border-t border-border">
          {!puedeGuardar && (
            <Aviso className="mb-6">
              Cargá al menos uno de los dos para poder calcular tus zonas.
            </Aviso>
          )}
          {error && <ErrorMensaje mensaje={error} className="mb-6" />}

          <Button type="submit" size="block" disabled={!puedeGuardar || enviando}>
            {enviando ? 'Guardando…' : 'Calcular mis zonas'}
          </Button>
        </section>
      </form>
    </main>
  );
}
