/**
 * Formateo y parseo de los datos que la app muestra y pide.
 *
 * Vive en `lib/` y no en `domain/` a propósito: son decisiones de presentación,
 * no de metodología.
 */

/** Segundos → "1:15:00" (o "45:00" si es menos de una hora). */
export function formatearTiempo(totalSegundos: number): string {
  const seg = Math.max(0, Math.round(totalSegundos));
  const horas = Math.floor(seg / 3600);
  const minutos = Math.floor((seg % 3600) / 60);
  const segundos = seg % 60;

  if (horas > 0) {
    return `${horas}:${pad(minutos)}:${pad(segundos)}`;
  }
  return `${minutos}:${pad(segundos)}`;
}

/**
 * "1:15:00" o "45:00" → segundos. `null` si no se entiende.
 *
 * Acepta las dos formas porque un 5K se piensa en minutos y un maratón en
 * horas, y obligar a escribir "0:25:00" para un 5K sería molesto.
 */
export function parsearTiempo(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(limpio)) return null;

  const partes = limpio.split(':').map(Number);
  if (partes.some((n) => !Number.isFinite(n))) return null;

  const [horas, minutos, segundos] =
    partes.length === 3 ? partes : [0, partes[0]!, partes[1]!];

  if (minutos! > 59 || segundos! > 59) return null;
  return horas! * 3600 + minutos! * 60 + segundos!;
}

/** Segundos por km → "5:00". */
export function formatearPaceCorto(secPorKm: number): string {
  const seg = Math.max(0, Math.round(secPorKm));
  return `${Math.floor(seg / 60)}:${pad(seg % 60)}`;
}

/** "5:00" → 300 segundos por km. `null` si no se entiende. */
export function parsearPace(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d{1,2}:\d{1,2}$/.test(limpio)) return null;

  const [minutos, segundos] = limpio.split(':').map(Number);
  if (segundos! > 59) return null;
  return minutos! * 60 + segundos!;
}

/** Fecha ISO (YYYY-MM-DD) → "lun 14 mar". */
export function formatearFechaCorta(fechaIso: string): string {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return fechaIso;
  return fecha.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Fecha ISO → "14 de marzo de 2026". */
export function formatearFechaLarga(fechaIso: string): string {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return fechaIso;
  return fecha.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Suma días a una fecha ISO (YYYY-MM-DD) y devuelve otra fecha ISO.
 *
 * Se trabaja en UTC a propósito: las fechas del plan son días de calendario, no
 * instantes. Usar la zona local haría que el mismo plan mostrara días distintos
 * según dónde esté el usuario.
 */
export function sumarDias(fechaIso: string, dias: number): string {
  const ms = Date.parse(`${fechaIso}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`Fecha inválida: ${fechaIso}`);
  return new Date(ms + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Lleva una fecha al lunes de su semana.
 *
 * Las semanas del plan arrancan el lunes porque el microciclo termina con el
 * largo, que casi siempre cae en fin de semana.
 */
export function lunesDeLaSemana(fechaIso: string): string {
  const date = new Date(`${fechaIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha inválida: ${fechaIso}`);
  // getUTCDay: 0 = domingo. El domingo pertenece a la semana que arrancó 6 días antes.
  const day = date.getUTCDay();
  return sumarDias(fechaIso, day === 0 ? -6 : 1 - day);
}

/** Hoy en formato ISO (YYYY-MM-DD), en hora local del usuario. */
export function hoyIso(): string {
  const ahora = new Date();
  // toISOString() convierte a UTC y puede adelantar o atrasar un día según la
  // zona horaria. Se arman las partes locales a mano para evitarlo.
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
}

/** Km con un decimal, sin el ".0" cuando es redondo: "24" / "24.5". */
export function formatearKm(km: number): string {
  return Number.isInteger(km) ? String(km) : km.toFixed(1);
}

/** Nombres cortos de los días de la semana, arrancando en lunes. */
export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
