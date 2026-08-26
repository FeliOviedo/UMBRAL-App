import { useState, type FormEvent } from 'react';
import { iniciarSesion, registrarse } from '@/data';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ErrorMensaje } from '@/components/ui/feedback';

type Modo = 'login' | 'registro';

/**
 * Login y registro en una sola pantalla.
 *
 * Se alterna entre los dos modos con un enlace en vez de con tabs: son la misma
 * acción con un campo de diferencia, y dos pestañas para eso serían cajas de más.
 */
export default function LoginScreen() {
  const [modo, setModo] = useState<Modo>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoConfirmacion, setAvisoConfirmacion] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      if (modo === 'login') {
        await iniciarSesion(email.trim(), password);
        // La navegación la maneja el store al detectar la sesión nueva.
      } else {
        const { necesitaConfirmarEmail } = await registrarse(
          email.trim(),
          password,
          nombre.trim() || undefined,
        );
        if (necesitaConfirmarEmail) setAvisoConfirmacion(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación.');
    } finally {
      setEnviando(false);
    }
  }

  if (avisoConfirmacion) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-edge">
        <p className="u-label">Umbral</p>
        <h1 className="mt-6 u-title">Revisá tu email</h1>
        <p className="u-sub mt-3">
          Te mandamos un link de confirmación a <span className="text-fg">{email}</span>. Abrilo
          para activar tu cuenta y después volvé acá a iniciar sesión.
        </p>
        <Button
          variant="ghost"
          size="block"
          className="mt-8"
          onClick={() => {
            setAvisoConfirmacion(false);
            setModo('login');
          }}
        >
          Volver a iniciar sesión
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-edge py-12">
      <header>
        <p className="u-label">Umbral</p>
        <h1 className="mt-6 u-title">
          {modo === 'login' ? 'Entrenar con cabeza' : 'Creá tu cuenta'}
        </h1>
        <p className="u-sub mt-3">
          {modo === 'login'
            ? 'Tu plan se ajusta a lo que realmente hacés, no al revés.'
            : 'Un plan que arranca de tu umbral y se adapta a cómo te sentís.'}
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-10 space-y-6">
        {modo === 'registro' && (
          <Field
            label="Nombre"
            type="text"
            autoComplete="name"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Cómo querés que te llamemos"
          />
        )}

        <Field
          label="Email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@email.com"
        />

        <Field
          label="Contraseña"
          type="password"
          required
          minLength={6}
          autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={modo === 'registro' ? 'Mínimo 6 caracteres.' : undefined}
        />

        {error && <ErrorMensaje mensaje={error} />}

        <Button type="submit" size="block" disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="u-sub mt-8 text-center">
        {modo === 'login' ? '¿Todavía no tenés cuenta? ' : '¿Ya tenés cuenta? '}
        <button
          type="button"
          className="text-accent underline underline-offset-4"
          onClick={() => {
            setModo(modo === 'login' ? 'registro' : 'login');
            setError(null);
          }}
        >
          {modo === 'login' ? 'Registrate' : 'Iniciá sesión'}
        </button>
      </p>
    </main>
  );
}
