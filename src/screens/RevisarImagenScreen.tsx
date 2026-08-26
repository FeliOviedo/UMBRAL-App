import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  actualizarSesion,
  obtenerSesion,
  subirImagenDeSesion,
  urlDeImagen,
  type SesionCompleta,
} from '@/data';
import {
  aCamposRevisables,
  obtenerProveedorVision,
  type CampoRevisable,
  type DatosDeImagen,
} from '@/domain';
import { useSession } from '@/store/session.store';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Aviso, Cargando, ErrorMensaje } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';

/**
 * Adjuntar la captura del reloj y revisar lo que se detecte.
 *
 * Tres cosas que esta pantalla hace a propósito:
 *
 * 1. **La imagen se guarda siempre**, se detecte algo o no. Aunque no haya
 *    modelo de visión configurado, tener la captura junto a la sesión ya sirve.
 * 2. **Lo detectado sale a campos editables**, nunca directo a la base. La
 *    persona confirma cada número.
 * 3. **Los valores dudosos se marcan pero se muestran igual.** Si el modelo
 *    leyó 1780 donde decía 178, esconderlo haría creer que la imagen no traía
 *    el dato.
 */
export default function RevisarImagenScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const usuario = useSession((s) => s.usuario);

  const [sesion, setSesion] = useState<SesionCompleta | null | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [campos, setCampos] = useState<CampoRevisable[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [avisosVision, setAvisosVision] = useState<string[]>([]);
  const [analizando, setAnalizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const proveedor = obtenerProveedorVision();

  useEffect(() => {
    if (!id) return;
    obtenerSesion(id)
      .then(async (s) => {
        setSesion(s);
        if (s?.imagenPath) setPreviewUrl(await urlDeImagen(s.imagenPath));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'No se pudo cargar la sesión.'),
      );
  }, [id]);

  // La URL del objeto local se revoca al cambiar de archivo o desmontar.
  useEffect(() => {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  async function detectar() {
    if (!archivo) return;
    setAnalizando(true);
    setError(null);
    try {
      const resultado = await proveedor.analizar(archivo);
      aplicarDetectado(resultado.datos);
      setAvisosVision(resultado.avisos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar la imagen.');
    } finally {
      setAnalizando(false);
    }
  }

  function aplicarDetectado(datos: DatosDeImagen) {
    const revisables = aCamposRevisables(datos);
    setCampos(revisables);
    setValores(Object.fromEntries(revisables.map((c) => [c.campo, String(c.valor)])));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!usuario || !sesion) return;

    setEnviando(true);
    setError(null);
    try {
      let imagenPath = sesion.imagenPath;
      if (archivo) {
        imagenPath = await subirImagenDeSesion(usuario.id, sesion.id, archivo);
      }

      const numero = (clave: string): number | undefined => {
        const crudo = valores[clave];
        if (crudo === undefined || crudo.trim() === '') return undefined;
        const n = Number(crudo);
        return Number.isFinite(n) ? n : undefined;
      };

      await actualizarSesion(sesion.id, {
        imagenPath,
        ...(numero('fcMaxima') !== undefined ? { fcMaxima: numero('fcMaxima') } : {}),
        ...(numero('cadenciaSpm') !== undefined ? { cadenciaSpm: numero('cadenciaSpm') } : {}),
      });

      navigate(`/sesion/${sesion.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setEnviando(false);
    }
  }

  if (sesion === undefined && !error) return <Cargando mensaje="Cargando sesión…" />;

  if (sesion === null) {
    return (
      <main className="u-page py-section">
        <p className="u-sub">No se encontró esa sesión.</p>
      </main>
    );
  }

  return (
    <main className="u-page flex flex-col gap-section pb-16 pt-8">
      <header>
        <span className="u-label">Captura del reloj</span>
        <h1 className="u-title mt-unit">Datos que el archivo no trae</h1>
        <p className="u-sub mt-2">
          FC máxima, zancada y training effect no vienen en el TCX. Podés adjuntar la captura de
          la app del reloj y cargarlos a mano.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-section">
        <section>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id="captura"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setArchivo(file);
            }}
          />

          {previewUrl ? (
            <div>
              <img
                src={previewUrl}
                alt="Captura de la sesión en la app del reloj"
                className="max-h-96 w-full rounded-md object-contain"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="u-label">{archivo?.name ?? 'Imagen guardada'}</span>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="font-mono text-label uppercase tracking-widest text-accent underline underline-offset-4"
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <label
              htmlFor="captura"
              className="flex cursor-pointer items-center justify-center border border-dashed border-border py-8 text-center"
            >
              <span className="u-sub">Tocá para elegir una captura</span>
            </label>
          )}
        </section>

        {archivo && (
          <section>
            {proveedor.disponible ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="block"
                  disabled={analizando}
                  onClick={() => void detectar()}
                >
                  {analizando ? 'Leyendo la imagen…' : 'Detectar datos de la imagen'}
                </Button>
                <p className="u-sub mt-3">
                  Lo que se detecte va a aparecer en campos editables. Revisalo antes de guardar:
                  son estimaciones, no lecturas exactas.
                </p>
              </>
            ) : (
              <Aviso>
                No hay un modelo de visión configurado, así que los datos van a mano. La imagen se
                guarda igual junto a la sesión.
              </Aviso>
            )}
          </section>
        )}

        {avisosVision.map((aviso) => (
          <Aviso key={aviso}>{aviso}</Aviso>
        ))}

        <section className="flex flex-col gap-gutter">
          <span className="u-label">Datos a confirmar</span>

          <CampoRevisado
            clave="fcMaxima"
            etiqueta="FC máxima"
            sufijo="ppm"
            campos={campos}
            valores={valores}
            setValores={setValores}
            placeholder={sesion?.fcMaxima != null ? String(sesion.fcMaxima) : 'Opcional'}
          />
          <CampoRevisado
            clave="cadenciaSpm"
            etiqueta="Cadencia"
            sufijo="spm"
            campos={campos}
            valores={valores}
            setValores={setValores}
            placeholder={sesion?.cadenciaSpm != null ? String(sesion.cadenciaSpm) : 'Opcional'}
          />
          <CampoRevisado
            clave="zancadaCm"
            etiqueta="Zancada"
            sufijo="cm"
            campos={campos}
            valores={valores}
            setValores={setValores}
            placeholder="Opcional"
          />
          <CampoRevisado
            clave="trainingEffect"
            etiqueta="Training effect"
            sufijo=""
            campos={campos}
            valores={valores}
            setValores={setValores}
            placeholder="Opcional"
          />
        </section>

        {error && <ErrorMensaje mensaje={error} />}

        <Button type="submit" size="block" disabled={enviando || (!archivo && campos.length === 0)}>
          {enviando ? 'Guardando…' : 'Confirmar y guardar'}
        </Button>
      </form>
    </main>
  );
}

/**
 * Un campo del formulario que puede venir precargado por la detección.
 *
 * Cuando el valor lo puso el modelo se marca con su nivel de confianza. Los
 * dudosos llevan un aviso explícito: la persona tiene que poder distinguir un
 * número que escribió ella de uno que escribió una máquina.
 */
function CampoRevisado({
  clave,
  etiqueta,
  sufijo,
  campos,
  valores,
  setValores,
  placeholder,
}: {
  clave: string;
  etiqueta: string;
  sufijo: string;
  campos: CampoRevisable[];
  valores: Record<string, string>;
  setValores: (fn: (v: Record<string, string>) => Record<string, string>) => void;
  placeholder: string;
}) {
  const detectado = campos.find((c) => c.campo === clave);

  return (
    <div>
      <Field
        label={etiqueta}
        type="number"
        inputMode="decimal"
        step="any"
        suffix={sufijo || undefined}
        value={valores[clave] ?? ''}
        onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value }))}
        placeholder={placeholder}
      />
      {detectado && (
        <p
          className={cn(
            'mt-2 font-mono text-label uppercase tracking-widest',
            detectado.dudoso ? 'text-zone-z4' : 'text-outline',
          )}
        >
          {detectado.dudoso
            ? `Detectado con poca certeza (${Math.round(detectado.confianza * 100)}%) — revisalo`
            : `Detectado (${Math.round(detectado.confianza * 100)}%)`}
        </p>
      )}
    </div>
  );
}
