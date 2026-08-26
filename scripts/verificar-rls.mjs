/**
 * Verificación de aislamiento entre usuarios (Row Level Security).
 *
 * Umbral no tiene backend propio: el navegador habla directo con Postgres
 * usando la anon key, que es pública. Lo único que impide que un usuario lea
 * los datos de otro son las políticas de RLS. Por eso no alcanza con haberlas
 * escrito — hay que comprobar que funcionan, y comprobarlo de nuevo cada vez
 * que se toca el esquema.
 *
 * El script crea dos usuarios de prueba, le hace escribir una sesión a cada
 * uno, y después intenta —desde la sesión de A— leer, modificar y borrar los
 * datos de B. Todo eso tiene que fallar o devolver vacío.
 *
 * Uso:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/verificar-rls.mjs
 *
 * Requiere que "Confirm email" esté DESACTIVADO en Authentication → Providers →
 * Email; si no, el registro queda pendiente y el script no puede iniciar sesión.
 * Los usuarios que crea quedan en el proyecto: se borran desde Authentication →
 * Users. Corré esto contra un proyecto de desarrollo, nunca contra producción.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  console.error('Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const sufijo = Date.now();
const CUENTAS = [
  { nombre: 'A', email: `umbral-rls-a-${sufijo}@example.com`, password: `Rls-A-${sufijo}!` },
  { nombre: 'B', email: `umbral-rls-b-${sufijo}@example.com`, password: `Rls-B-${sufijo}!` },
];

/** Tablas que tienen que quedar aisladas. El esquema las trata a todas igual. */
const TABLAS = ['profiles', 'thresholds', 'goals', 'plans', 'plan_weeks', 'plan_days', 'sessions', 'adaptations'];

let fallas = 0;

function chequear(descripcion, ok, detalle = '') {
  console.log(`${ok ? '  ok  ' : ' FALLA'}  ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallas++;
}

async function crearUsuario({ nombre, email, password }) {
  const cliente = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await cliente.auth.signUp({ email, password });
  if (error) throw new Error(`No se pudo registrar al usuario ${nombre}: ${error.message}`);

  if (!data.session) {
    const { data: login, error: errorLogin } = await cliente.auth.signInWithPassword({
      email,
      password,
    });
    if (errorLogin || !login.session) {
      throw new Error(
        `El usuario ${nombre} se registró pero no pudo iniciar sesión. ` +
          'Probablemente "Confirm email" esté activado en el proyecto.',
      );
    }
    return { nombre, cliente, id: login.user.id };
  }

  return { nombre, cliente, id: data.user.id };
}

/** Una sesión de entrenamiento mínima, propiedad del usuario que la escribe. */
async function sembrarSesion(usuario) {
  const { data, error } = await usuario.cliente
    .from('sessions')
    .insert({
      user_id: usuario.id,
      discipline: 'running',
      training_type: 'F',
      occurred_at: new Date().toISOString(),
      rpe: 4,
      feeling: 4,
      duration_seconds: 1800,
      distance_meters: 5000,
      metabolic_load: 120,
      source: 'manual',
      notes: `Sesión privada de ${usuario.nombre}`,
    })
    .select()
    .single();

  if (error) throw new Error(`El usuario ${usuario.nombre} no pudo escribir su propia sesión: ${error.message}`);
  return data.id;
}

console.log(`\nVerificando aislamiento RLS contra ${URL}\n`);

const a = await crearUsuario(CUENTAS[0]);
const b = await crearUsuario(CUENTAS[1]);
console.log(`Usuarios de prueba creados:\n  A = ${a.id}\n  B = ${b.id}\n`);

const sesionA = await sembrarSesion(a);
const sesionB = await sembrarSesion(b);
console.log('Cada usuario escribió una sesión propia.\n');

console.log('LECTURA — A no tiene que ver nada de B');
for (const tabla of TABLAS) {
  const { data, error } = await a.cliente.from(tabla).select('user_id, id');
  if (error) {
    chequear(`${tabla}`, false, `error inesperado al leer: ${error.message}`);
    continue;
  }
  const columna = tabla === 'profiles' ? 'id' : 'user_id';
  const ajenas = data.filter((fila) => fila[columna] !== a.id);
  chequear(
    `${tabla}: ${data.length} fila(s) visible(s), 0 ajenas`,
    ajenas.length === 0,
    ajenas.length > 0 ? `${ajenas.length} fila(s) de otro usuario` : '',
  );
}

console.log('\nLECTURA DIRIGIDA — A pide explícitamente la sesión de B por id');
{
  const { data, error } = await a.cliente.from('sessions').select('*').eq('id', sesionB);
  chequear('sessions?id=eq.<sesión de B>', !error && data.length === 0, error?.message ?? `devolvió ${data?.length} fila(s)`);
}

console.log('\nESCRITURA — A no tiene que poder tocar los datos de B');
{
  const { data, error } = await a.cliente
    .from('sessions')
    .update({ notes: 'modificada por A' })
    .eq('id', sesionB)
    .select();
  chequear('UPDATE sobre la sesión de B', error !== null || data.length === 0, error?.message ?? 'el update afectó filas');
}
{
  const { data, error } = await a.cliente.from('sessions').delete().eq('id', sesionB).select();
  chequear('DELETE sobre la sesión de B', error !== null || data.length === 0, error?.message ?? 'el delete afectó filas');
}
{
  const { error } = await a.cliente.from('sessions').insert({
    user_id: b.id, // suplantación: A escribe como si fuera B
    discipline: 'running',
    training_type: 'F',
    occurred_at: new Date().toISOString(),
    rpe: 4,
    feeling: 4,
    duration_seconds: 600,
    metabolic_load: 40,
    source: 'manual',
  });
  chequear('INSERT firmado como B (suplantación)', error !== null, error ? `rechazado: ${error.code}` : 'lo aceptó');
}

console.log('\nCONTROL — B sigue viendo lo suyo intacto');
{
  const { data, error } = await b.cliente.from('sessions').select('*').eq('id', sesionB).single();
  chequear('B lee su propia sesión', !error && data?.notes === 'Sesión privada de B', error?.message ?? `notes = ${data?.notes}`);
}
{
  const { data } = await b.cliente.from('sessions').select('id');
  chequear('B ve exactamente 1 sesión (la suya)', data?.length === 1, `ve ${data?.length}`);
}

console.log('\nSTORAGE — el bucket de capturas también aísla');
{
  const contenido = new Blob(['captura falsa'], { type: 'image/png' });
  const { error: errorPropio } = await a.cliente.storage
    .from('session-images')
    .upload(`${a.id}/${sesionA}.png`, contenido, { upsert: true });
  chequear('A sube una imagen a su propia carpeta', errorPropio === null, errorPropio?.message ?? '');

  const { error: errorAjeno } = await a.cliente.storage
    .from('session-images')
    .upload(`${b.id}/intruso.png`, contenido, { upsert: true });
  chequear('A NO puede subir a la carpeta de B', errorAjeno !== null, errorAjeno ? 'rechazado' : 'lo aceptó');

  const { data: listado } = await a.cliente.storage.from('session-images').list(b.id);
  chequear('A NO puede listar la carpeta de B', !listado || listado.length === 0, `devolvió ${listado?.length ?? 0} item(s)`);
}

console.log(
  fallas === 0
    ? '\n✓ Aislamiento verificado: ningún dato de un usuario es visible ni modificable por el otro.\n'
    : `\n✗ ${fallas} chequeo(s) fallaron. NO publiques con estas políticas.\n`,
);
console.log(`Borrá los usuarios de prueba en Authentication → Users:\n  ${CUENTAS[0].email}\n  ${CUENTAS[1].email}\n`);

process.exit(fallas === 0 ? 0 : 1);
