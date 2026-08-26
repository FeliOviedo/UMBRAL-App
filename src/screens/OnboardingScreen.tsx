import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { actualizarPerfil } from '@/data';
import { PROGRESSION_TABLE } from '@/domain';
import type { BasePaceLevel } from '@/domain/types';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Chips, Field } from '@/components/ui/field';
import { ErrorMensaje } from '@/components/ui/feedback';
import { formatearPaceCorto } from '@/lib/format';

/**
 * Onboarding: los dos datos con los que arranca la progresión de volumen.
 *
 * Se pide lo mínimo indispensable — cuánto corre por semana hoy y a qué ritmo —
 * porque son las dos entradas de la Tabla 7. Todo lo demás se puede completar
 * después desde Configuración.
 */
export default function OnboardingScreen() {
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);
  const perfil = useSession((s) => s.perfil);
  const setPerfil = useSession((s) => s.setPerfil);

  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [volumenKm, setVolumenKm] = useState(
    perfil?.volumenSemanalKm != null ? String(perfil.volumenSemanalKm) : '',
  );
  const [ritmoBase, setRitmoBase] = useState<BasePaceLevel | null>(perfil?.ritmoBase ?? null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const volumenNumero = Number(volumenKm.replace(',', '.'));
  const volumenValido = Number.isFinite(volumenNumero) && volumenNumero > 0;
  const puedeGuardar = volumenValido && ritmoBase !== null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!usuario || !puedeGuardar) return;

    setEnviando(true);
    setError(null);
    try {
      const actualizado = await actualizarPerfil(usuario.id, {
        nombre: nombre.trim() || null,
        volumenSemanalKm: volumenNumero,
        ritmoBase,
        onboardingCompleto: true,
      });
      setPerfil(actualizado);
      navigate('/umbral');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar tu perfil.');
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 pb-16">
      <header className="u-section">
        <p className="u-label">Paso 1 de 3</p>
        <h1 className="mt-6 font-display text-3xl font-semibold leading-tight">
          Contanos dónde estás parado
        </h1>
        <p className="u-sub mt-3">
          Con esto arrancamos la progresión de volumen. No hace falta que sea exacto: el plan se
          va a ir ajustando con lo que entrenes de verdad.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-10">
        <Field
          label="Nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Cómo querés que te llamemos"
        />

        <Field
          label="Cuántos km corrés por semana hoy"
          type="text"
          inputMode="decimal"
          required
          value={volumenKm}
          onChange={(e) => setVolumenKm(e.target.value)}
          placeholder="20"
          suffix="km"
          hint="Un promedio de las últimas semanas. Si venís parando, poné lo que corrías antes de parar."
        />

        <Chips
          label="A qué ritmo corrés cómodo"
          value={ritmoBase}
          onChange={setRitmoBase}
          options={PROGRESSION_TABLE.map((fila) => ({
            value: fila.level,
            label: fila.label,
            hint: `${formatearPaceCorto(fila.paceSecPerKm)}/km`,
          }))}
          hint="El ritmo de tus salidas tranquilas, no el de una carrera. Define cuántos km se suman por semana."
        />

        {error && <ErrorMensaje mensaje={error} />}

        <Button type="submit" size="block" disabled={!puedeGuardar || enviando}>
          {enviando ? 'Guardando…' : 'Seguir'}
        </Button>
      </form>
    </main>
  );
}
