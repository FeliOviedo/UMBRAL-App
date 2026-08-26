/**
 * Capturas de pantalla del reloj, en Supabase Storage.
 *
 * El bucket es privado y la política de RLS exige que el primer segmento del
 * path sea el uid del usuario, así que la ruta NO es cosmética: es lo que hace
 * que nadie pueda leer las imágenes de otro. Por eso se arma acá y no la manda
 * quien llama.
 */

import { supabase } from '@/lib/supabase';
import { DataError } from './errors';

const BUCKET = 'session-images';

/** 5 MB. Una captura de teléfono ronda 1-2 MB; más que esto es otra cosa. */
const TAMANIO_MAXIMO = 5 * 1024 * 1024;

const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/**
 * Sube la captura y devuelve su path.
 *
 * El path se guarda en `sessions.image_path`; la URL firmada se pide aparte y
 * caduca, así que no tiene sentido persistirla.
 */
export async function subirImagenDeSesion(
  userId: string,
  sessionId: string,
  archivo: File,
): Promise<string> {
  if (archivo.size > TAMANIO_MAXIMO) {
    throw new DataError('La imagen no puede pesar más de 5 MB.');
  }
  if (archivo.type && !TIPOS_ACEPTADOS.includes(archivo.type)) {
    throw new DataError('Sólo se aceptan imágenes JPG, PNG, WebP o HEIC.');
  }

  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  // El uid va primero porque la política de Storage compara ese segmento.
  const path = `${userId}/${sessionId}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, {
    upsert: true,
    contentType: archivo.type || undefined,
  });

  if (error) {
    throw new DataError('No se pudo subir la imagen. Probá de nuevo.', error);
  }

  return path;
}

/**
 * URL temporal para mostrar la imagen.
 *
 * El bucket es privado, así que no hay URL pública: hay que firmar cada vez.
 * Una hora alcanza de sobra para ver una pantalla de detalle.
 */
export async function urlDeImagen(path: string, segundos = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, segundos);
  if (error) return null;
  return data.signedUrl;
}

export async function borrarImagen(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new DataError('No se pudo borrar la imagen.', error);
}
